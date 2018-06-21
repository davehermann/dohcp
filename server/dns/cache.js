// Application modules
const { Trace, Debug } = require(`../logging`);

// The cache is simply an object with properties that self-delete
let _cache = {};

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

module.exports.AddToCache = add;
module.exports.FindInCache = lookup;
