// Node/NPM modules
const fs = require(`fs`),
    path = require(`path`);
// Application modules
const { AllocatedAddress } = require(`./allocatedAddress`),
    { Dev, Trace, Info } = require(`../logging`),
    { AddDHCPToDNS } = require(`../dns/cache`);

let _configuration = new WeakMap(),
    _allocations = new WeakMap();

class Allocations {
    constructor(configuration) {
        _configuration.set(this, configuration);

        this._allocateAddressing();
    }

    get configuration() { return _configuration.get(this); }
    get allocatedAddresses() { return _allocations.get(this); }

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

        Dev({ poolIps, staticIps });

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

        Dev({ allocations });
        _allocations.set(this, allocations);
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
        let dataFile = path.join(process.cwd(), `status`, `dhcp.json`);

        let contents = fs.readFileSync(dataFile, { encoding: `utf8` });

        return JSON.parse(contents);
    }

    _writeToDisk() {
        // Write the allocations to disk
        return new Promise((resolve, reject) => {
            let dataFile = path.join(process.cwd(), `status`, `dhcp.json`);
            Trace({ dataFile });
            fs.writeFile(dataFile, JSON.stringify(this.allocatedAddresses, null, 4), { encoding: `utf8` }, (err) => {
                if (!!err)
                    reject(err);

                resolve();
            });
        });
    }

    _offerOpenAddress(currentTime) {
        let openAddresses = [],
            knownAllocations = [];
        for (let ip in this.allocatedAddresses.byIp) {
            let data = this.allocatedAddresses.byIp[ip];
            if (!data)
                openAddresses.push(ip);
        }

        for (let clientId in this.allocatedAddresses.byClientId) {
            let ip = this.allocatedAddresses.byClientId[clientId],
                data = this.allocatedAddresses.byIp[ip];

            // Only add expired leases
            if (data.leaseExpirationTimestamp < currentTime.getTime())
                knownAllocations.push(ip);
        }

        // 3a) Prefer never-used addresses first
        let poolAddresses = openAddresses.filter(ip => { return knownAllocations.indexOf(ip) < 0; });
        if (poolAddresses.length == 0) {
            // Take all known allocations, sort chronologically by lease expiration, and add only the IP that expired first
            let knownAddresses = knownAllocations.map(ip => { return { ip, data: this.allocatedAddresses.byIp[ip] }; });
            knownAddresses.sort((a, b) => { return a.data.leaseExpirationTimestamp - b.data.leaseExpirationTimestamp; });

            if (knownAddresses.length > 0)
                poolAddresses.push(knownAddresses[0]);
        }

        // Select a random address from the pool
        if (poolAddresses.length > 0)
            return poolAddresses[Math.floor(Math.random() * poolAddresses.length)];

        return null;
    }

    _addAllocation(assignedAddress) {
        // Add the assignment to the byIp list
        this.allocatedAddresses.byIp[assignedAddress.ipAddress] = assignedAddress;

        // Add a confirmed assignment to the byClientId list
        if (assignedAddress.isConfirmed)
            this.allocatedAddresses.byClientId[assignedAddress.clientId] = assignedAddress.ipAddress;

        // Write the allocations to disk
        return this._writeToDisk();
    }

    OfferAddress(dhcpMessage) {
        let pOffer = Promise.resolve();

        let clientId = dhcpMessage.options.clientIdentifier,
            // Check pre-configured addresses
            allStaticLeases = this.configuration.dhcp.leases.static,
            // As uniqueId could be either an ID or a type/id name-value pair, check for just the value match
            staticLease = allStaticLeases[clientId.uniqueId] || allStaticLeases[clientId.address],
            assignedAddress = new AllocatedAddress(clientId),
            currentTime = new Date();

        assignedAddress.lastMessageId = dhcpMessage.xid;
        // Expire the address in 30 seconds, to ensure the next cleanup cycle removes it if the client never responds
        assignedAddress.SetExpiration(currentTime, 30);

        // A match means offer the match (Static allocation)
        if (!!staticLease) {
            assignedAddress.ipAddress = staticLease.ip;

            if (!!staticLease.hostname)
                assignedAddress.staticHost = staticLease.hostname;
        }
        // No match means offer an address from the pool (Dynamic allocation)
        else {
            // Address assignment steps
            // 1) If the client has a previously assigned address, use that
            // 2) If the client requests a specific address, use that if it's free
            // 3) Use any open address
            let ip = this._offerOpenAddress(currentTime);
            if (!!ip)
                assignedAddress.ipAddress = ip;
        }

        if (!!assignedAddress.ipAddress) {
            // Add the provided hostname to the lease
            if (!!dhcpMessage.options.hostNameOption)
                assignedAddress.providedHost = dhcpMessage.options.hostNameOption;

            // Add the allocation to the tracking
            pOffer = this._addAllocation(assignedAddress)
                // Return the address
                .then(() => Promise.resolve(assignedAddress));
        }

        return pOffer;
    }

    ConfirmAddress(dhcpMessage) {
        let pConfirm = Promise.resolve();

        let clientId = dhcpMessage.options.clientIdentifier,
            requestedIp = dhcpMessage.options.requestedIPAddress;

        // Check the requested IP against the assignment list
        let assignedAddress = this.allocatedAddresses.byIp[requestedIp];

        // If the client identifier matches for the assigned IP
        Trace({ clientId, requestedIp, assignedAddress });

        if (assignedAddress.clientId == clientId.uniqueId) {
            // Confirm the address
            assignedAddress.ConfirmAddress();
            // Add to the known addresses
            this.allocatedAddresses.byClientId[clientId.uniqueId] = assignedAddress.ipAddress;

            // Write the updated status
            pConfirm = this._writeToDisk()
                // Add to DNS Cache
                .then(() => AddDHCPToDNS(assignedAddress, dhcpMessage, _configuration.get(this)))
                .then(hostname => { Info(`DHCP: Assigning ${assignedAddress.ipAddress} to ${dhcpMessage.chaddr}, and in DNS as ${hostname}`); })
                // Return the address
                .then(() => Promise.resolve(assignedAddress));
        }

        return pConfirm;
    }
}

module.exports.Allocations = Allocations;
