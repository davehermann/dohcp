// Application modules
const { AllocatedAddress } = require(`./allocatedAddress`),
    { Trace, Debug } = require(`../logging`);

let _configuration = new WeakMap();

class Allocations {
    constructor(configuration) {
        _configuration.set(this, configuration);

        this._allocateAddressing();
    }

    get configuration() { return _configuration.get(this); }

    _allocateAddressing() {
        let allocations = this._LoadFromDisk();

        if (!allocations)
            allocations = {
                byIp: {},
                byClientId: {}
            };

        // List all known static allocated IPs
        let staticIps = [];
        for (let clientId in this.configuration.dhcp.leases.static)
            staticIps.push(this.configuration.dhcp.leases.static[clientId].ip);

        // Generate a list of all possible pool IPs for dynamic allocation
        let poolIps = [];
        this.configuration.dhcp.leases.pool.ranges.forEach(range => {
            let startAddress = this._ipOctet(range.start),
                endAddress = this._ipOctet(range.end);

            this._incrementAddress(startAddress, endAddress, () => {
                // Don't add any IPs from the static allocation list
                let ipAddress = startAddress.join(`.`);
                if (staticIps.indexOf(ipAddress) < 0)
                    poolIps.push(ipAddress);
            });
        });

        Trace({ poolIps, staticIps });

        // Clean up prior allocations by stepping through existing IPs, and remove any that are not in the pool
        for (let ip in allocations.byIp)
            // Ignore any static allocated leases
            if ((poolIps.indexOf(ip) < 0) && (staticIps.indexOf(ip) < 0))
                delete allocations.byIp[ip];

        // Step through all pool IPs, and add any missing to the allocations list
        poolIps.forEach(ip => {
            if (!allocations.byIp[ip])
                allocations.byIp[ip] = null;
        });

        Debug({ allocations });
        return allocations;
    }

    _incrementAddress(startAddress, endAddress, idx, callback) {
        if (!callback) {
            callback = idx;
            idx = 0;
        }

        if (idx < startAddress.length)
            while ((startAddress[idx] <= endAddress[idx]) && (startAddress[idx] <= 255)) {
                this._incrementAddress(startAddress, endAddress, idx + 1, callback);
                startAddress[idx]++;
            }
        else
            callback();
    }

    _ipOctet(ipAddress) {
        let parts = ipAddress.split(`.`).map(octet => { return +octet; });
        return parts;
    }

    _LoadFromDisk() {
        // NOT IMPLEMENTED YET
        return null;
    }

    OfferAddress(dhcpMessage) {
        let clientId = dhcpMessage.options.clientIdentifier,
            // Check pre-configured addresses
            allStaticLeases = this.configuration.dhcp.leases.static,
            // As uniqueId could be either an ID or a type/id name-value pair, check for just the value match
            staticLease = allStaticLeases[clientId.uniqueId] || allStaticLeases[clientId.address],
            assignedAddress = new AllocatedAddress(clientId);

        // A match means offer the match (Static allocation)
        if (!!staticLease) {
            assignedAddress.ipAddress = staticLease.ip;

            if (!!staticLease.hostname)
                assignedAddress.staticHost = staticLease.hostname;
        }
        // No match means offer an address from the pool (Dynamic allocation)
        else {
            // If the client requests a specific address, use it if it's never been assigned, or if the client is the previous assignee
            // Otherwise, use the address previously assigned to the client
            // If no address has previously been assigned, use any open address
            // Prefer never-used addresses to previously allocated (Automatic allocation)
        }


    }
}

module.exports.Allocations = Allocations;
