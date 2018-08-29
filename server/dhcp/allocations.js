// Node/NPM modules
const fs = require(`fs`),
    path = require(`path`);
// Application modules
const { AllocatedAddress } = require(`./allocatedAddress`),
    { HistoryAssignment } = require(`./history`),
    { Dev, Trace, Debug, Info } = require(`../logging`),
    { AddDHCPToDNS } = require(`../dns/cache`);

let _configuration, _addressAllocations;

// Track permanent storage write requests as not all offers/confirms need to be written
let _saveOnNextWrite = false;
// Write a minimum of once every few minutes
setInterval(() => { _saveOnNextWrite = true; }, 300000);

function allocateAddressing(configuration) {
    _configuration = configuration;

    return loadFromDisk()
        .then(allocations => {
            if (!allocations)
                allocations = {
                    byIp: {},
                    byClientId: {}
                };

            // List all known static allocated IPs
            let staticIps = [];
            for (let clientId in _configuration.dhcp.leases.static)
                staticIps.push(_configuration.dhcp.leases.static[clientId].ip);

            // Generate a list of all possible pool IPs for dynamic allocation
            let poolIps = [];
            _configuration.dhcp.leases.pool.ranges.forEach(range => {
                let startAddress = getIpOctets(range.start),
                    endAddress = getIpOctets(range.end);

                Debug({ startAddress, endAddress }, `dhcp`);

                for (let idx = 0, ipLength = startAddress.length; idx < ipLength; idx++) {
                    // Add each IP in the range to the list
                    while ((startAddress[idx] <= endAddress[idx]) && (startAddress[idx] <= 255)) {
                        let ipAddress = startAddress.join(`.`);

                        // Don't add any IPs from the static allocation list
                        if (staticIps.indexOf(ipAddress) < 0)
                            poolIps.push(ipAddress);

                        startAddress[idx]++;
                    }

                    // Decrement the octet for the next loop as it's been incremented once more than needed
                    startAddress[idx]--;
                }
            });

            Dev({ poolIps, staticIps }, `dhcp`);

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

            Dev({ allocations }, `dhcp`);
            _addressAllocations = allocations;

            return Promise.resolve();
        });
}

function loadFromDisk() {
    let dataFile = path.join(process.cwd(), `status`, `dhcp.json`);

    return new Promise((resolve, reject) => {
        fs.readFile(dataFile, { encoding: `utf8` }, (err, contents) => {
            if (!!err)
                reject(err);
            else
                resolve(JSON.parse(contents));
        });
    });
}

function getIpOctets(ipAddress) {
    let parts = ipAddress.split(`.`).map(octet => { return +octet; });
    return parts;
}

function confirmAddress (dhcpMessage) {
    let pConfirm = Promise.resolve();

    let clientId = dhcpMessage.options.clientIdentifier,
        requestedIp = dhcpMessage.options.requestedIPAddress || dhcpMessage.ciaddr;

    // Check the requested IP against the assignment list
    let assignedAddress = _addressAllocations.byIp[requestedIp];

    // If the client identifier matches for the assigned IP
    Trace({ clientId, requestedIp, assignedAddress }, `dhcp`);

    if (assignedAddress.clientId == clientId.uniqueId) {
        if (!assignedAddress.isConfirmed)
            _saveOnNextWrite = true;

        // Confirm the address
        assignedAddress.ConfirmAddress(_configuration);
        // Add to the known addresses
        _addressAllocations.byClientId[clientId.uniqueId] = assignedAddress.ipAddress;

        // Write the updated status
        pConfirm = writeToDisk()
            // Add to DNS Cache
            .then(() => AddDHCPToDNS(assignedAddress, dhcpMessage, _configuration))
            .then(hostname => {
                HistoryAssignment(dhcpMessage, assignedAddress, hostname);
                return hostname;
            })
            .then(hostname => { Info(`DHCP: Assigning ${assignedAddress.ipAddress} to ${dhcpMessage.chaddr}, and in DNS as ${hostname}`, `dhcp`); })
            // Return the address
            .then(() => Promise.resolve(assignedAddress));
    }

    return pConfirm;
}

function writeToDisk() {
    let pWrite = Promise.resolve();

    // Write the allocations to disk
    if (_saveOnNextWrite) {
        Debug(`Writing DHCP data`, `dhcp`);

        pWrite = new Promise((resolve, reject) => {
            let dataFile = path.join(process.cwd(), `status`, `dhcp.json`);
            Trace({ dataFile }, `dhcp`);

            // Sort the allocations keys to make debugging easier
            // Since we're writing JSON, use a JSON copy
            let allocations = JSON.parse(JSON.stringify(_addressAllocations)),
                writeData = { byIp: {}, byClientId: {} };

            let ipKeys = Object.keys(allocations.byIp).sort(),
                clientKeys = Object.keys(allocations.byClientId).sort();

            ipKeys.forEach(key => { writeData.byIp[key] = allocations.byIp[key]; });
            clientKeys.forEach(key => { writeData.byClientId[key] = allocations.byClientId[key]; });

            fs.writeFile(dataFile, JSON.stringify(writeData, null, 4), { encoding: `utf8` }, (err) => {
                if (!!err)
                    reject(err);

                resolve();
            });
        });
    } else
        Debug(`Not writing DHCP update`, `dhcp`);

    return pWrite
        .then(() => {
            _saveOnNextWrite = false;
        });
}

function offerAddress(dhcpMessage) {
    let pOffer = Promise.resolve();

    let clientId = dhcpMessage.options.clientIdentifier,
        // Check pre-configured addresses
        allStaticLeases = _configuration.dhcp.leases.static,
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
        let ip;
        // Address assignment steps
        // 1) If the client has a previously assigned address, use that
        if (!!_addressAllocations.byClientId[clientId.uniqueId])
            ip = _addressAllocations.byClientId[clientId.uniqueId];
        // 2) If the client requests a specific address, use that if it's free
        else {
            // Check the assigned address list to see if an offer has been made
            for (let ipAddress in _addressAllocations.byIp) {
                let address = _addressAllocations.byIp[ipAddress];

                if (!!address && (address.clientId == clientId.uniqueId)) {
                    ip = ipAddress;
                    break;
                }
            }
        }

        // 3) Use any open address
        if (!ip)
            ip = findOpenAddressToOffer(currentTime);

        if (!!ip)
            assignedAddress.ipAddress = ip;
    }

    if (!!assignedAddress.ipAddress) {
        // Add the provided hostname to the lease
        if (!!dhcpMessage.options.hostNameOption)
            assignedAddress.providedHost = dhcpMessage.options.hostNameOption;

        // Add the allocation to the tracking
        pOffer = addAllocation(assignedAddress)
            // Return the address
            .then(() => Promise.resolve(assignedAddress));
    }

    return pOffer;
}

function findOpenAddressToOffer(currentTime) {
    let openAddresses = [],
        knownAllocations = [];
    for (let ip in _addressAllocations.byIp) {
        let data = _addressAllocations.byIp[ip];
        if (!data)
            openAddresses.push(ip);
    }

    for (let clientId in _addressAllocations.byClientId) {
        let ip = _addressAllocations.byClientId[clientId],
            data = _addressAllocations.byIp[ip];

        // Only add expired leases
        if (!data || (data.leaseExpirationTimestamp < currentTime.getTime()))
            knownAllocations.push(ip);
    }

    // 3a) Prefer never-used addresses first
    let poolAddresses = openAddresses.filter(ip => { return knownAllocations.indexOf(ip) < 0; });
    if (poolAddresses.length == 0) {
        // Take all known allocations, sort chronologically by lease expiration, and add only the IP that expired first
        let knownAddresses = knownAllocations.map(ip => { return { ip, data: _addressAllocations.byIp[ip] }; });
        knownAddresses.sort((a, b) => { return a.data.leaseExpirationTimestamp - b.data.leaseExpirationTimestamp; });

        if (knownAddresses.length > 0)
            poolAddresses.push(knownAddresses[0]);
    }

    // Select a random address from the pool
    if (poolAddresses.length > 0)
        return poolAddresses[Math.floor(Math.random() * poolAddresses.length)];

    return null;
}

function addAllocation(assignedAddress) {
    let priorAssignment = _addressAllocations.byIp[assignedAddress.ipAddress];
    if (!priorAssignment || (priorAssignment.clientId !== assignedAddress.clientId) || (priorAssignment.isConfirmed != assignedAddress.isConfirmed))
        _saveOnNextWrite = true;


    // Add the assignment to the byIp list
    _addressAllocations.byIp[assignedAddress.ipAddress] = assignedAddress;

    // Add a confirmed assignment to the byClientId list
    if (assignedAddress.isConfirmed)
        _addressAllocations.byClientId[assignedAddress.clientId] = assignedAddress.ipAddress;

    // Write the allocations to disk
    return writeToDisk();
}

function matchRequestToAllocation(dhcpMessage) {
    let clientId = dhcpMessage.options.clientIdentifier,
        requestedIp = dhcpMessage.options.requestedIPAddress || dhcpMessage.ciaddr,
        assignedAddress = _addressAllocations.byIp[requestedIp];

    // The message has to be a request
    // The message client has to be assigned to the message requested IP
    if ((dhcpMessage.options.dhcpMessageType == `DHCPREQUEST`) && (!!assignedAddress && (assignedAddress.clientId == clientId.uniqueId))) {
        if (!(assignedAddress instanceof AllocatedAddress)) {
            let addressObject = new AllocatedAddress();
            addressObject.FromStorage(assignedAddress);

            _addressAllocations.byIp[requestedIp] = addressObject;
        }

        return Promise.resolve(true);
    }

    return Promise.resolve(false);
}

function getAllocations() {
    return _addressAllocations;
}

module.exports.AllocateAddressing = allocateAddressing;
module.exports.ConfirmAddress = confirmAddress;
module.exports.OfferAddress = offerAddress;
module.exports.MatchRequest = matchRequestToAllocation;
module.exports.GetAllocations = getAllocations;
