// The cache is simply an object with properties that self-delete

let _cache = {};

function add(dnsResponse) {
    // Any answers within the response need to be cached
    dnsResponse.answers.forEach(answer => {
        let existing = _cache[answer.name];
        if (!!existing) {
            // Clear the TTL removal
            clearTimeout(existing.removal);

            remove(answer.name);
        }

        _cache[answer.name] = {
            removal: setTimeout(() => { remove(answer.name); }, answer.ttl * 1000),
            answer: answer.Copy()
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
