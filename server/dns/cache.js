// Application modules
const { Trace, Debug } = require(`../logging`);

// The cache is simply an object with properties that self-delete
let _cache = {};

function add(dnsResponse) {
    // Any answers within the response need to be cached
    dnsResponse.answers.forEach(answer => {
        let cacheAnswer = answer.toCache();
        if (cacheAnswer.maximumCacheLength > 0) {
            Trace({ [`New cache entry`]: cacheAnswer });

            let existing = lookup(cacheAnswer.label);
            if (!!existing) {
                Trace(`${cacheAnswer.label} found in cache`);

                // Clear the TTL removal
                clearTimeout(existing.removal);

                remove(cacheAnswer.label);
            }

            Debug(`Adding ${cacheAnswer.label} to cache with removal in ${cacheAnswer.maximumCacheLength} seconds`);
            _cache[cacheAnswer.label] = {
                removal: setTimeout(() => { remove(cacheAnswer.label); }, cacheAnswer.maximumCacheLength * 1000),
                answer: cacheAnswer
            };
        }
    });
}

function lookup(name) {
    let found = [],
        inCache = null;

    while (!!name) {
        inCache = _cache[name];
        name = null;

        if (!!inCache) {
            found.push(inCache);

            // Checking here for any CNAME resolution will short-circuit additional lookups
            if (inCache.answer.rrType == `CNAME`)
                name = inCache.answer.resourceData;
        }
    }

    return (found.length > 0) ? found.map(cacheEntry => { return cacheEntry.answer; }) : null;
}

function remove(nameToRemove) {
    // Remove the entry
    delete _cache[nameToRemove];
}

module.exports.AddToCache = add;
module.exports.FindInCache = lookup;
