// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { Debug, Dev, Trace } from "multi-level-logger";

// Application Modules
import { OctetsToNumber, NumberToOctets } from "../../utilities";
import { IAllocations, IAllocatedAddress, IRange } from "../../../interfaces/configuration/dhcp";
import { IConfiguration } from "../../../interfaces/configuration/configurationFile";

const PERSISTENT_DHCP_STATUS = path.join(process.cwd(), `status`, `dhcp.json`);

class Addressing {
    constructor(private readonly configuration: IConfiguration) {}

    //#region Private properties
    private persistentAllocations: IAllocations;
    //#endregion Private properties

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
            byIp: new Map<string, IAllocatedAddress>(),
            byClientId: new Map<string, string>(),
        };

        try {
            const contents = await fs.readFile(PERSISTENT_DHCP_STATUS, { encoding: `utf8` });
            const objAddressing: IAllocations = JSON.parse(contents);

            // Add the MAC-to-IP map
            for (const [mac, ip] of objAddressing.byClientId.entries())
                persistentAllocations.byClientId.set(mac, ip);

            // Add the IP-to-Known-host map
            for (const [ip, host] of objAddressing.byIp.entries())
                persistentAllocations.byIp.set(ip, host);
        } catch (err) {
            // Any error reading can simply be ignored, with the empty object returned
        }

        return persistentAllocations;
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

        Dev({ allocations: this.persistentAllocations }, { logName: `dhcp` });
    }

    //#endregion Public methods
}

export {
    Addressing,
};
