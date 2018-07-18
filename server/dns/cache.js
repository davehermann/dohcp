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
    let randomizedAddress = dhcpMessage.options.vendorClassIdentifier;
    if (!!randomizedAddress && (randomizedAddress.length > 0)) {
        // Append a letter to the identifier
        let useChar = 65;
        while (!!_cache[`${randomizedAddress}-${String.fromCharCode(useChar)}`])
            useChar++;

        randomizedAddress = `${randomizedAddress}-${String.fromCharCode(useChar)}`;
    } else
        randomizedAddress = dhcpMessage.options.clientIdentifier.uniqueId;

    let hostname = assignedAddress.hostname || randomizedAddress;

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
                    { name: hostname, ip: assignedAddress.ipAddress }
                ]
            },
        },
        true
    );

    return Promise.resolve(hostname);
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

function lookup(label) {
    let cacheHit = _cache[label.toLowerCase()],
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
    let existing = lookup(answer.label);
    if (!!existing) {
        Trace(`${answer.label} found in cache. Cleaning up before re-adding.`);

        // Clear the TTL removal
        if (!!existing.cacheRemoval)
            clearTimeout(existing.cacheRemoval);

        remove(answer.label);
    }

    // Add an expiration for DHCP-configured leases
    if (!!ttl)
        answer.cacheRemoval = setTimeout(() => { remove(answer.label); }, ttl * 1000);
    else
        answer.noExpiration = true;

    Trace({ [`New cache entry`]: answer });
    _cache[answer.label.toLowerCase()] = answer;
}

function remove(labelToRemove) {
    // Remove the entry
    delete _cache[labelToRemove.toLowerCase()];
}

function listCache() {
    return _cache;
}

module.exports.LoadPreconfiguredRecords = addFromConfiguration;
module.exports.AddToCache = add;
module.exports.FindInCache = lookup;
module.exports.AddDHCPToDNS = addFromDHCP;
module.exports.ListCache = listCache;
