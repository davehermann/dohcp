// Application modules
const { Trace } = require(`../logging`);

// The cache is simply an object with properties that self-delete
let _cache = {};

function add(dnsResponse) {
    // Any answers within the response need to be cached
    dnsResponse.answers.forEach(answer => {
        let cacheAnswer = answer.toCache();
        Trace({ cacheAnswer });

        let existing = lookup(cacheAnswer.label);
        if (!!existing) {
            Trace(`${cacheAnswer.label} found in cache`);

            // Clear the TTL removal
            clearTimeout(existing.removal);

            remove(cacheAnswer.label);
        }

        Trace(`Adding ${cacheAnswer.label} to cache with removal in ${cacheAnswer.maximumCacheLength} seconds`);
        _cache[cacheAnswer.label] = {
            removal: setTimeout(() => { remove(cacheAnswer.label); }, cacheAnswer.maximumCacheLength * 1000),
            answer: cacheAnswer
        };
    });
}

function lookup(name) {
    return _cache[name];
}

function remove(nameToRemove) {
    // Remove the entry
    delete _cache[nameToRemove];
}

module.exports.AddToCache = add;
module.exports.FindInCache = lookup;
