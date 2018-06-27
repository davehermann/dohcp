// Application modules
const { Answer } = require(`./rfc1035/answer`),
    { DNSMessage } = require(`./rfc1035/dnsMessage`),
    { Trace, Debug } = require(`../logging`);

// The cache is simply an object with properties that self-delete
let _cache = {};

function addFromConfiguration(configuration) {
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
            let answer = new Answer();
            answer.label = record.name;
            answer.typeId = (!!record.alias ? 5 : 1);
            answer.classId = 1;
            answer.noExpiration = true;
            answer.rdata.push(record.alias || record.ip);

            _cache[answer.label] = answer;
        });
    }
}

function add(dnsResponse) {
    // Any answers within the response need to be cached
    dnsResponse.answers.forEach(answer => {
        // Calculate the remaining TTL
        let currentTime = new Date(),
            remainingTTL = (answer.ttlExpiration - currentTime.getTime());

        // Only cache if TTL is > 1000
        if (remainingTTL > 1000) {
            Debug(`Adding ${answer.label} to cache with removal in ${answer.startingTTL} seconds`);

            let existing = lookup(answer.label);
            if (!!existing) {
                Trace(`${answer.label} found in cache. Cleaning up before re-adding.`);

                // Clear the TTL removal
                clearTimeout(existing.removal);
                remove(answer.label);
            }

            answer.cacheRemoval = setTimeout(() => { remove(answer.label); }, answer.startingTTL * 1000);
            Trace({ [`New cache entry`]: answer });
            _cache[answer.label] = answer;
        }
    });
}

function lookup(label) {
    return _cache[label];
}

function remove(labelToRemove) {
    // Remove the entry
    delete _cache[labelToRemove];
}

module.exports.LoadPreconfiguredRecords = addFromConfiguration;
module.exports.AddToCache = add;
module.exports.FindInCache = lookup;
