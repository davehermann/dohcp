// Node/NPM modules
const https = require(`https`),
    { Resolver } = require(`dns`);

// Application modules
const { AddToCache, FindInCache } = require(`./cache`),
    { DNSMessage } = require(`./rfc1035/dnsMessage`),
    { Dev, Trace, Debug, Warn, Err } = require(`../logging`);

function resolveQuery(dnsQuery, configuration) {
    let hasWarning = false,
        pLookup = Promise.resolve();

    // Log anything unexpected to Warn
    if (dnsQuery.header.numberOfQuestions !== 1 || (dnsQuery.questions.filter(q => { return q.rrType !== `A`; }).length > 0)) {
        Warn({ [`Unexpected Query`]: dnsQuery });
        hasWarning = true;
    }

    // Check cache first
    if (!hasWarning) {
        let cacheHit = FindInCache(dnsQuery.questions[0].label);
        Debug({ cacheHit });
        if (!!cacheHit)
            pLookup = pLookup
                .then(() => { return respondFromCache(dnsQuery, cacheHit); });
    }

    // If cache didn't find it, return a lookup
    return pLookup
        .then(answer => { return !!answer ? answer : lookupInDns(dnsQuery, configuration); })
        .then(dnsAnswer => {
            // If the bottom record is a CNAME, then we need to resolve the CNAME and add to the answers here
            return dnsAnswer;
        });
}

function respondFromCache(dnsQuery, cachedAnswer) {
    Trace(`Responding from cache`);

    // If the answer is a CNAME that doesn't have the entry in cache, a lookup is required

    // Create a new message
    let dnsAnswer = new DNSMessage();
    Trace({ dnsQuery, cachedAnswer });
    dnsAnswer.ReplyFromCache(dnsQuery, cachedAnswer);
    Trace(`Reply generated`);
    Debug({ [`Decoded as Hex`]: dnsAnswer.toHex(), [`Decoded Answer`]: dnsAnswer });

    return Promise.resolve(dnsAnswer);
}

function lookupInDns(dnsQuery, configuration) {
    return resolveDnsHost(configuration)
        .then(dohResolver => {
            Trace(`Retrieving DNS`);

            return new Promise((resolve, reject) => {
                let request = {
                    hostname: dohResolver.doh.ipAddress[0],
                    path: dohResolver.doh.path,
                    headers: {
                        [`Host`]: dohResolver.doh.hostname,
                        [`Content-Length`]: dnsQuery.buffer.length,
                    },
                };

                let useMethod = dohResolver.doh.methods.filter(method => { return method.method == dohResolver.doh.defaultMethod; })[0];

                request.method = useMethod.method;
                useMethod.headers.forEach(header => {
                    for (let name in header)
                        request.headers[name] = header[name];
                });

                Dev({ request });

                let req = https.request(request, (res) => {
                    Trace({ status: res.statusCode, headers: res.headers });

                    let data = [];

                    res.on(`data`, chunk => {
                        // chunk is a buffer
                        Dev({ chunk: chunk.toString(`hex`) });
                        data.push(chunk.toString(`hex`));
                    });

                    res.on(`end`, () => {
                        Dev({ data });
                        resolve(Buffer.from(data.join(``), `hex`));
                    });
                });

                req.on(`error`, (err) => {
                    Err(err);
                    reject(err);
                });

                req.write(dnsQuery.buffer);
                req.end();
            });
        })
        .then(response => {
            Trace({ [`Complete Response`]: response.toString(`hex`) });

            let dnsAnswer = new DNSMessage(response);
            Debug({ [`Decoded as Hex`]: dnsAnswer.toHex(), [`Decoded Answer`]: dnsAnswer });

            AddToCache(dnsAnswer);

            return Promise.resolve(dnsAnswer);
        });
}

function resolveDnsHost(configuration) {
    // Query a DNS server for the DNS-over-HTTPS host
    return new Promise((resolve, reject) => {
        // Check configuration for the resolver to use
        let resolver = configuration.dns.upstream.resolvers.filter(resolver => { return resolver.name == configuration.dns.upstream.primary; })[0];

        Trace({ resolver });

        // Resolve the hostname (may be in cache, or perform a DNS lookup)
        let dnsResolve = new Resolver();
        dnsResolve.setServers(resolver.servers);
        dnsResolve.resolve4(resolver.doh.hostname, { ttl: true }, (err, records) => {
            if (!!err) {
                Err(`DoH hostname resolution error`);
                reject(err);
            } else {
                Trace({ [`hostname`]: resolver.doh.hostname, records });
                resolver.doh.ipAddress = records.map(entry => { return entry.address; });
                resolve(resolver);
            }
        });

        // Provide the IP, and resolver parameters
    });
}

module.exports.ResolveDNSQuery = resolveQuery;