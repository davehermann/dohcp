// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { Debug, Trace, Info } from "multi-level-logger";
import { EnsurePathForFile } from "@davehermann/fs-utilities";

// Application Modules
import { OctetsToNumber, NumberToOctets } from "../../utilities";
import { IRange } from "../../../interfaces/configuration/dhcp";
import { IConfiguration } from "../../../interfaces/configuration/configurationFile";
import { DHCPMessage } from "../dhcpMessage";
import { AllocatedAddress } from "./AllocatedAddress";
import { DNSServer } from "../../dns/dns-main";
import { ClientHistory } from "../../history/history";

interface IAllocations {
    byIp: Map<string, AllocatedAddress>;
    byClientId: Map<string, string>;
}

/** Absolute path for the DHCP persistent storage file on disk */
const PERSISTENT_DHCP_STATUS = path.join(process.cwd(), `status`, `dhcp.json`);
/** Force allocations to write at the next write call */
const MAXIMUM_UNWRITTEN_ALLOCATION_AGE = 300000;

class Addressing {
    constructor(private readonly configuration: IConfiguration, private readonly dnsServer: DNSServer, private readonly history: ClientHistory) {}

    //#region Private properties
    private persistentAllocations: IAllocations;

    /**
     * The last time allocations were written to disk
     *
     * @remarks
     * A time of (0) forces a write on the next disk update
     */
    private lastAllocationSaveToDisk = new Date(0);
    //#endregion Private properties

    public get AllAllocations(): IAllocations {
        return this.persistentAllocations;
    }

    //#region Private methods

    /** Get the address pool(s) and static assignments */
    private addressPool() {
        // Get an array of static IP assignments
        const staticAssignedIPs: Array<string> = [];
        for (const assignment of this.configuration.dhcp.leases.static.values())
            staticAssignedIPs.push(assignment.ip);

        // Generate a list of all possible pool IPs for dynamic allocation
        const poolIps: Array<string> = [];
        this.configuration.dhcp.leases.pool.ranges.forEach(range => poolIps.splice(poolIps.length, 0, ...this.getAddressesInRange(range)));

        // Remove all static IPs from the list of pool addresses
        staticAssignedIPs.forEach(ipAddress => {
            const idxInPool = poolIps.findIndex(poolAddress => (poolAddress == ipAddress));

            if (idxInPool >= 0)
                poolIps.splice(idxInPool, 1);
        });

        Trace({ poolIps, staticAssignedIPs }, { logName: `dhcp` });

        return { poolIps, staticAssignedIPs };
    }

    /** Get all IP pool addresses within the specified range */
    private getAddressesInRange(range: IRange): Array<string> {
        const startAddress = OctetsToNumber(Uint8Array.from(range.start.split(`.`).map(val => +val))),
            endAddress = OctetsToNumber(Uint8Array.from(range.end.split(`.`).map(val => +val)));

        Debug({ startAddress, endAddress }, { logName: `dhcp` });

        const rangeIps: Array<string> = [];

        for (let addressInRange = startAddress; addressInRange <= endAddress; addressInRange++)
            // Convert the address back into the decimal representation to add to the list of pool IPs
            rangeIps.push(NumberToOctets(addressInRange).join(`.`));

        return rangeIps;
    }

    /** Load prior address allocations that have been saved in persistent storage */
    private async getStoredAllocations(): Promise<IAllocations> {
        // Create an empty allocation object
        const persistentAllocations: IAllocations = {
            byIp: new Map<string, AllocatedAddress>(),
            byClientId: new Map<string, string>(),
        };

        try {
            const contents = await fs.readFile(PERSISTENT_DHCP_STATUS, { encoding: `utf8` });
            const objAddressing: any = JSON.parse(contents);

            // Add the MAC-to-IP map
            for (const mac in objAddressing.byClientId) {
                const ip = objAddressing.byClientId[mac];
                persistentAllocations.byClientId.set(mac, ip);
            }

            // Add the IP-to-Known-host map
            for (const ip in objAddressing.byIp) {
                const host = objAddressing.byIp[ip];
                if (!!host)
                    persistentAllocations.byIp.set(ip, new AllocatedAddress(host, this.configuration.dhcp.leases.pool.leaseSeconds));
            }
        } catch (err) {
            // Any error reading can simply be ignored, with the empty object returned
            Debug(err, { asIs: true, logName: `dns` });
        }

        return persistentAllocations;
    }

    //#region Allocate Address to client

    /**
     * Assign an address from the pool of addresses
     * @param dhcpMessage - DHCP request message sent by client
     * @param assignedAddress - Object holding the address allocation for the client
     *
     * @remarks
     * Address assignment steps
     *   1. If the client has a previously assigned address, use that
     *   1. If the client requests a specific address, use that if it's free
     *   1. Use any open address
     */
    private poolOffer(dhcpMessage: DHCPMessage, assignedAddress: AllocatedAddress): void {
        let ip: string = null;

        // Try to find a previously allocated address for the client
        if (!!this.persistentAllocations.byClientId.get(assignedAddress.clientId))
            ip = this.persistentAllocations.byClientId.get(assignedAddress.clientId);

        // Try to find a previously offered address for the client
        if (!ip)
            for (const [ipAddress, allocation] of this.persistentAllocations.byIp.entries())
                if (!!allocation && (allocation.clientId === assignedAddress.clientId)) {
                    ip = ipAddress;
                    break;
                }

        // Try to assign the client the specific address the client asks for
        // NOT IMPLEMENTED YET

        // Assign any open address
        if (!ip)
            ip = this.findOpenPoolAddressToOffer();

        if (!!ip)
            assignedAddress.ipAddress = ip;
    }

    /**
     * Attempt to locate a static address allocation for the DHCP client
     * @param dhcpMessage - DHCP request message sent by client
     * @param assignedAddress - Object holding the address allocation for the client
     */
    private staticOffer(dhcpMessage: DHCPMessage, assignedAddress: AllocatedAddress): boolean {
        const clientId = dhcpMessage.clientIdentifier;

        // As uniqueId could be either an ID or a type/id name-value pair, check for just the value match
        const staticAssignment = this.configuration.dhcp.leases.static.get(clientId.uniqueId) || this.configuration.dhcp.leases.static.get(clientId.address);

        if (!!staticAssignment) {
            assignedAddress.ipAddress = staticAssignment.ip;

            if (!!staticAssignment.hostname)
                assignedAddress.staticHost = staticAssignment.hostname;

            return true;
        }

        return false;
    }

    /** Scan the address pool to find a usable address for the client */
    private findOpenPoolAddressToOffer(): string {
        const currentTime = new Date();

        const openAddresses: Array<string> = [],
            knownAllocations: Array<string> = [];

        // Step through all allocations by IP, and add any unallocated addresses
        for (const [ipAddress, allocation] of this.persistentAllocations.byIp.entries())
            if (!allocation)
                openAddresses.push(ipAddress);

        // Find prior addresses not in-use
        for (const [clientId, ipAddress] of this.persistentAllocations.byClientId.entries()) {
            const allocation = this.persistentAllocations.byIp.get(ipAddress);

            // Only add expired leases
            if (!allocation || (allocation.leaseExpirationTimestamp.getTime() < currentTime.getTime()))
                knownAllocations.push(ipAddress);
        }

        // Prefer never-used addresses first
        const availableAddressesToOffer = openAddresses.filter(ip => (knownAllocations.indexOf(ip) < 0));

        // If there are no unused addresses
        if (availableAddressesToOffer.length == 0) {
            // Offer the address that has been expired the longest amount of time
            const knownAddresses = knownAllocations.map(ip => { return { ip, allocation: this.persistentAllocations.byIp.get(ip) }; });
            knownAddresses.sort((a, b) => (a.allocation.leaseExpirationTimestamp.getTime() - b.allocation.leaseExpirationTimestamp.getTime()));

            if (knownAddresses.length > 0)
                availableAddressesToOffer.push(knownAddresses[0].ip);
        }

        // Select a random address from the pool
        if (availableAddressesToOffer.length > 0)
            return availableAddressesToOffer[Math.floor(Math.random() * availableAddressesToOffer.length)];

        return null;
    }

    //#endregion Allocate Address to client

    /**
     * Pull the address allocation by requested IP
     * @param dhcpMessage - DHCP message from client
     */
    private getAddressAllocationForIP(dhcpMessage: DHCPMessage) {
        const requestedIp = dhcpMessage.requestedIP || dhcpMessage.clientExistingIP,
            assignedAddress = this.persistentAllocations.byIp.get(requestedIp);

        return { assignedAddress, requestedIp };
    }

    /**
     * Track an address allocation in memory and on disk
     * @param assignedAddress - Address allocation assigned to the client
     */
    private async trackAllocatedAddress(assignedAddress: AllocatedAddress): Promise<void> {
        const existingAllocation = this.persistentAllocations.byIp.get(assignedAddress.ipAddress);

        // Force disk write if the allocation changed by setting write time to zero
        if (!existingAllocation || (existingAllocation.clientId !== assignedAddress.clientId) || (existingAllocation.isConfirmed !== assignedAddress.isConfirmed))
            this.lastAllocationSaveToDisk = new Date(0);

        // Add the allocation to the in-memory address list
        this.persistentAllocations.byIp.set(assignedAddress.ipAddress, assignedAddress);

        // Update the client assigned address list if the allocation is confirmed
        if (assignedAddress.isConfirmed)
            this.persistentAllocations.byClientId.set(assignedAddress.clientId, assignedAddress.ipAddress);

        // Wait for changes to write to disk
        await this.writeToDisk();
    }

    /** Write allocations to permanent storage */
    private async writeToDisk() {
        const currentTime = new Date();

        // Only write periodically, after the last write expires
        if ((this.configuration.dhcp.writeToDisk !== false) && (currentTime.getTime() > (this.lastAllocationSaveToDisk.getTime() + MAXIMUM_UNWRITTEN_ALLOCATION_AGE))) {
            Debug(`Writing DHCP update to disk at "${PERSISTENT_DHCP_STATUS}"`, { logName: `dhcp` });

            await EnsurePathForFile(PERSISTENT_DHCP_STATUS);

            // Create a copy of the allocations, using generic objects
            const writeData = { byIp: {}, byClientId: {} };

            for (const [ipAddress, allocation] of this.persistentAllocations.byIp.entries())
                writeData.byIp[ipAddress] = allocation;

            for (const [clientId, ipAddress] of this.persistentAllocations.byClientId.entries())
                writeData.byClientId[clientId] = ipAddress;

            await fs.writeFile(PERSISTENT_DHCP_STATUS, JSON.stringify(writeData, null, 4), { encoding: `utf8` });

            this.lastAllocationSaveToDisk = currentTime;
        } else
            Debug(`Writing DHCP update to disk is currently disabled.`, { logName: `dhcp` });
    }

    //#endregion Private methods

    //#region Public methods

    /** Allocate the address space available from the configuration settings */
    public async Allocate(): Promise<void> {
        this.persistentAllocations = await this.getStoredAllocations();

        const { staticAssignedIPs, poolIps } = this.addressPool();

        // Clean up prior allocations by stepping through existing IPs, and drop any that aren't in the current pool
        for (const ip of this.persistentAllocations.byIp.keys())
            // If the address isn't in the pool and isn't in the static list
            if ((poolIps.indexOf(ip) < 0) && (staticAssignedIPs.indexOf(ip) < 0))
                // Drop it from the allocations
                this.persistentAllocations.byIp.delete(ip);

        // Add all pool IPs to the allocations list, if the IP isn't in it
        poolIps.forEach(ip => {
            if (!this.persistentAllocations.byIp.has(ip))
                this.persistentAllocations.byIp.set(ip, null);
        });

        Trace({ allocations: {
            byIp: [...this.persistentAllocations.byIp.entries()],
            byClientId: [...this.persistentAllocations.byClientId.entries()] }
        }, { logName: `dhcp` });
    }

    /**
     * Determine an available address from the pool to offer to the client
     *   + Offer prior assigned, or statically configured, addresses for known clients
     *
     * @param dhcpMessage - DHCP request message sent by client
     */
    public async OfferToClient(dhcpMessage: DHCPMessage): Promise<AllocatedAddress> {
        const assignedAddress = new AllocatedAddress(dhcpMessage.clientIdentifier, this.configuration.dhcp.leases.pool.leaseSeconds),
            currentTime = new Date();

        assignedAddress.lastMessageId = dhcpMessage.clientMessageId;
        // Expire the address in 30 seconds, to ensure the next cleanup cycle removes it if the client never responds
        assignedAddress.SetExpiration(currentTime, 30);

        // First, check static assignments for the client
        const hasStaticAssignment = this.staticOffer(dhcpMessage, assignedAddress);

        // No match means offer an address from the pool (Dynamic allocation)
        if (!hasStaticAssignment)
            this.poolOffer(dhcpMessage, assignedAddress);

        if (!!assignedAddress.ipAddress) {
            // Add a provided hostname to the lease
            if (!!dhcpMessage.clientProvidedHostname)
                assignedAddress.providedHost = dhcpMessage.clientProvidedHostname;

            // Track the allocation
            await this.trackAllocatedAddress(assignedAddress);

            return assignedAddress;
        }

        return null;
    }

    /**
     * Confirm an address the client's requesting as issued by this service
     * @param dhcpMessage - DHCP message sent by the client
     */
    public async ConfirmClientAddress(dhcpMessage: DHCPMessage): Promise<AllocatedAddress> {
        const { assignedAddress, requestedIp} = this.getAddressAllocationForIP(dhcpMessage);

        // Handle instances where the stored allocations have data by Client ID, but not by IP Address
        //      The addressAllocation may be null and will need to be regenerated
        //      Only regenerate when this is an authoritative server
        let addressAllocation = assignedAddress;
        if (!addressAllocation && this.configuration.dhcp.authoritative)
            addressAllocation = await this.OfferToClient(dhcpMessage);

        Trace({ clientId: dhcpMessage.clientIdentifier.uniqueId, requestedIp, addressAllocation }, { logName: `dhcp`});

        // If the client identifier matches for the assigned IP
        if (addressAllocation.clientId == dhcpMessage.clientIdentifier.uniqueId) {
            // Write the allocation list to disk
            if (!addressAllocation.isConfirmed)
                this.lastAllocationSaveToDisk = new Date(0);

            // Mark the address as confirmed
            addressAllocation.ConfirmAddress();

            // Track the allocation
            await this.trackAllocatedAddress(addressAllocation);

            // Add to DNS Cache
            let hostnameInDNS: string;
            if (this.dnsServer.isEnabled)
                hostnameInDNS = this.dnsServer.cache.AddFromDHCP(addressAllocation.hostname, addressAllocation.ipAddress, addressAllocation.clientId, dhcpMessage.vendorClassIdentifier, this.configuration.dhcp.leases.pool.leaseSeconds);

            // Add to the DHCP history for the client
            this.history.AddDHCPAssignment(dhcpMessage, addressAllocation, hostnameInDNS);

            Info(`DHCP: Assigning ${addressAllocation.ipAddress} to ${dhcpMessage.clientHardwareIdentifier}, and in DNS as ${hostnameInDNS}`, { logName: `dhcp` });

            return addressAllocation;
        }

        return null;
    }

    /**
     * Match a client-sent requested IP address to the address allocation this service has
     * @param dhcpMessage - DHCP message sent by the client
     */
    public async MatchRequestToAllocation(dhcpMessage: DHCPMessage): Promise<boolean> {
        const { assignedAddress } = this.getAddressAllocationForIP(dhcpMessage);

        // The message has to be a request
        // The message client has to be assigned to the message requested IP
        if ((dhcpMessage.messageType == `DHCPREQUEST`) && (assignedAddress?.clientId === dhcpMessage.clientIdentifier.uniqueId)) {
            /*
            DO WE HAVE TO LOAD FROM STORAGE IN SOME EDGE CASES???
                - Last Version
            --------------------------------------------------------------
                if (!(assignedAddress instanceof AllocatedAddress)) {
                    let addressObject = new AllocatedAddress();
                    addressObject.FromStorage(assignedAddress);

                    _addressAllocations.byIp[requestedIp] = addressObject;
                }
            --------------------------------------------------------------
            */
            return true;
        }

        return false;
    }

    //#endregion Public methods
}

export {
    IAllocations,
    Addressing,
};
