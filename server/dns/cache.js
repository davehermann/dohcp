// The cache is simply an object with properties that self-delete

let _cache = {};

function add(dnsResponse) {
    // Any answers within the response need to be cached
    dnsResponse.answers.forEach(answer => {
        let cacheAnswer = answer.toCache();

        let existing = _cache[cacheAnswer.label];
        if (!!existing) {
            // Clear the TTL removal
            clearTimeout(existing.removal);

            remove(cacheAnswer.label);
        }

        _cache[cacheAnswer.label] = {
            removal: setTimeout(() => { remove(cacheAnswer.label); }, cacheAnswer.maximumCacheLength * 1000),
            answer: cacheAnswer
        };
    });
}

function lookup(name) {
    let found = _cache[name];
    return !!found ? found.answer : null;
}

function remove(nameToRemove) {
    // Remove the entry
    delete _cache[nameToRemove];
}

module.exports.AddToCache = add;
module.exports.FindInCache = lookup;
