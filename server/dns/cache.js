// Application modules
const { Answer } = require(`./rfc1035/answer`),
    { Trace, Debug } = require(`../logging`);

// The cache is simply an object with properties that self-delete
let _cache = {};

function addFromConfiguration(configuration, fromDHCP) {
    // Add A and CNAME cache records from configuration

    if (!!configuration.dns.records) {
        let records = configuration.dns.records.filter(() => { return true; });

        // Add the defined domain
        if (!!configuration.dns.domain && (configuration.dns.domain.length > 0))
            configuration.dns.records.forEach(record => {
                // To the label if it isn't included
                if (record.name.search(new RegExp(`${configuration.dns.domain.replace(/\./g, `\\.`)}$`)) < 0) {
                    let copy = JSON.parse(JSON.stringify(record));

                    copy.name += `.${configuration.dns.domain}`;

                    records.push(copy);
                }
            });

        records.forEach(record => {
            let answer = new Answer(),
                ttl = null;
            answer.label = record.name;
            answer.typeId = (!!record.alias ? 5 : 1);
            answer.classId = 1;
            answer.rdata.push(record.alias || record.ip);

            // Add an expiration for DHCP-configured leases
            if (fromDHCP && !!configuration.dhcp.leases.pool.leaseSeconds)
                ttl = configuration.dhcp.leases.pool.leaseSeconds;

            storeInCache(answer, ttl);
        });
    }
}

function addFromDHCP(assignedAddress, dhcpMessage, configuration) {
    // Select the hostname
    let uniqueHostname = assignedAddress.hostname;

    // If neither a static host or provided host exists, use the vendor identifier plus a letter
    if (!uniqueHostname) {
        let randomizedAddress = dhcpMessage.options.vendorClassIdentifier;
        if (!!randomizedAddress && (randomizedAddress.length > 0)) {
            // Append a letter to the identifier
            let useChar = 65;
            while (!!_cache[`${randomizedAddress}-${String.fromCharCode(useChar)}`])
                useChar++;

            randomizedAddress = `${randomizedAddress}-${String.fromCharCode(useChar)}`;
        }

        if (!!randomizedAddress)
            uniqueHostname = randomizedAddress;
    }

    // If there's still no unique hostname, use the unique ID for the client
    if (!uniqueHostname)
        uniqueHostname = dhcpMessage.options.clientIdentifier.uniqueId;
    else {
        // If there is a unique hostname, make sure it doesn't collide with another name, and if it does use the last 6 of the unique ID

        while (!!_cache[uniqueHostname] && (_cache[uniqueHostname].rdata[0] !== assignedAddress.ipAddress))
            uniqueHostname += `-${dhcpMessage.options.clientIdentifier.uniqueId.substr(dhcpMessage.options.clientIdentifier.uniqueId.length - 6)}`;
    }

    uniqueHostname = uniqueHostname.replace(/ /g, `_`);

    // Pass to the addFromConfiguration to add to cache
    addFromConfiguration(
        {
            dhcp: {
                leases: {
                    pool: {
                        leaseSeconds: configuration.dhcp.leases.pool.leaseSeconds
                    }
                }
            },
            dns: {
                domain: configuration.dns.domain,
                records: [
                    { name: uniqueHostname, ip: assignedAddress.ipAddress }
                ]
            },
        },
        true
    );

    return Promise.resolve(uniqueHostname);
}

function add(dnsResponse) {
    // Any answers within the response need to be cached
    dnsResponse.answers.forEach(answer => {
        // Calculate the remaining TTL
        let currentTime = new Date(),
            remainingTTL = Math.round((answer.ttlExpiration - currentTime.getTime()) / 1000);

        // Only cache if TTL is > 1000
        if (remainingTTL > 1) {
            Debug(`Adding ${answer.label} to cache with removal in ${remainingTTL} seconds`, `dns`);

            storeInCache(answer, remainingTTL);
        }
    });
}

function lookup(cacheId) {
    let label = cacheId.split(`:`)[0],
        cacheHit = _cache[cacheId.toLowerCase()],
        cacheReturn = undefined;

    if (!!cacheHit) {
        // Use a copy of the cached object
        cacheReturn = cacheHit.Clone();

        // And set the cache label to match the query's casing
        cacheReturn.label = label;
    }

    return cacheReturn;
}

function storeInCache(answer, ttl) {
    let cacheId = generateCacheId(answer);

    let existing = lookup(cacheId);
    if (!!existing) {
        Trace(`${cacheId} found in cache. Cleaning up before re-adding.`);

        // Clear the TTL removal
        if (!!existing.cacheRemoval)
            clearTimeout(existing.cacheRemoval);

        remove(cacheId);
    }

    // Add an expiration for DHCP-configured leases
    if (!!ttl)
        answer.cacheRemoval = setTimeout(() => { remove(cacheId); }, ttl * 1000);
    else
        answer.noExpiration = true;

    Trace({ [`New cache entry - ${cacheId.toLowerCase()}`]: answer }, `dns`);
    _cache[cacheId.toLowerCase()] = answer;
}

function remove(labelToRemove) {
    // Remove the entry
    delete _cache[labelToRemove.toLowerCase()];
}

function listCache() {
    return _cache;
}

function generateCacheId(answer) {
    return `${answer.label}:${answer.typeId}:${answer.classId}`;
}

module.exports.LoadPreconfiguredRecords = addFromConfiguration;
module.exports.AddToCache = add;
module.exports.FindInCache = lookup;
module.exports.AddDHCPToDNS = addFromDHCP;
module.exports.ListCache = listCache;
module.exports.GenerateCacheId = generateCacheId;
