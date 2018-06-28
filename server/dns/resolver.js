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
    if (dnsQuery.qdcount !== 1 || (dnsQuery.questions.filter(q => { return q.typeId !== 1; }).length > 0)) {
        Warn({ [`UNEXPECTED QUERY`]: dnsQuery });
        hasWarning = true;
    }

    // Check cache first, but only for expected queries
    if (!hasWarning) {
        let label = dnsQuery.questions[0].label,
            cacheHit = FindInCache(label);
        Debug({ label, cacheHit });
        if (!!cacheHit)
            pLookup = respondFromCache(dnsQuery, cacheHit);
    }

    // If cache didn't find it, return a lookup
    return pLookup
        .then(answer => { return !!answer ? answer : lookupInDns(dnsQuery, configuration); })
        .then(answer => {
            let pAnswer = Promise.resolve(answer);

            // Non-standard queries will return as-resolved
            if (!hasWarning) {
                // If the last answer in the answer's list is a CNAME, perform a sub-query
                let lastAnswer = answer.answers[answer.answers.length - 1];
                if (!lastAnswer) {
                    Warn({ [`NO lastAnswer`]: dnsQuery.questions });
                }
                if (!!lastAnswer && (lastAnswer.typeId == 5)) {
                    let subQuery = new DNSMessage();
                    subQuery.AddQuestions([lastAnswer.rdata[0]]);
                    subQuery.Generate();

                    pAnswer = resolveQuery(subQuery, configuration)
                        .then(subAnswer => {
                            answer.AddAnswers(subAnswer.answers);

                            return answer;
                        });
                }

                // With the expanded answers, create a new response message
                pAnswer = pAnswer
                    .then(answer => {
                        // Anything not expected should return unmanipulated
                        if (!lastAnswer || (answer.nscount > 0))
                            return answer;
                        else {
                            let dnsAnswer = new DNSMessage();
                            dnsAnswer.AddQuestions(dnsQuery.questions.map(q => { return q.label; }));
                            dnsAnswer.AddAnswers(answer.answers);

                            dnsAnswer.Generate(dnsQuery.queryId, true, dnsQuery.rd);
                            Trace({ dnsAnswer });
                            Trace({ asHex: dnsAnswer.dnsMessage.toString(`hex`) });

                            return dnsAnswer;
                        }
                    });
            }

            return pAnswer;
        });
}

function respondFromCache(dnsQuery, cachedAnswer) {
    Trace(`Responding from cache`);
    Dev({ dnsQuery, cachedAnswer });

    // Create a new message
    let dnsAnswer = new DNSMessage();
    // Add this answer
    dnsAnswer.AddAnswers([cachedAnswer]);

    return Promise.resolve(dnsAnswer);
}

function lookupInDns(dnsQuery, configuration) {
    Trace(`Forwarding to public resolver`);
    return resolveDnsHost(configuration)
        .then(dohResolver => {
            Trace(`Resolving query in forward DNS`);

            return new Promise((resolve, reject) => {
                let request = {
                    hostname: dohResolver.doh.ipAddress[0],
                    path: dohResolver.doh.path,
                    headers: {
                        [`Host`]: dohResolver.doh.hostname,
                        [`Content-Length`]: dnsQuery.dnsMessage.length,
                    },
                };

                let useMethod = dohResolver.doh.methods.filter(method => { return method.method == dohResolver.doh.defaultMethod; })[0];

                request.method = useMethod.method;
                useMethod.headers.forEach(header => {
                    for (let name in header)
                        request.headers[name] = header[name];
                });

                Dev({ [`DoH request`]: request });

                let req = https.request(request, (res) => {
                    Trace({[`DoH response`]: { status: res.statusCode, headers: res.headers }});

                    let data = [];

                    res.on(`data`, chunk => {
                        // chunk is a buffer
                        Dev({ [`Data chunk`]: chunk.toString(`hex`) });
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

                req.write(dnsQuery.dnsMessage);
                req.end();
            });
        })
        .then(response => {
            Trace({ [`Complete Response`]: response.toString(`hex`) });

            let dnsAnswer = new DNSMessage();
            dnsAnswer.FromDNS(response);
            Debug({ dnsAnswer });

            // Do not cache Authoritative responses
            if (dnsAnswer.nscount == 0)
                AddToCache(dnsAnswer);

            return Promise.resolve(dnsAnswer);
        });
}

function resolveDnsHost(configuration) {
    // Query a DNS server for the DNS-over-HTTPS host
    return new Promise((resolve, reject) => {
        // Check configuration for the resolver to use
        let resolver = configuration.dns.upstream.resolvers.filter(resolver => { return resolver.name == configuration.dns.upstream.primary; })[0];

        Trace({ [`Loading resolver`]: resolver });

        // Resolve the hostname (may be in cache, or perform a DNS lookup)
        let dnsResolve = new Resolver();
        dnsResolve.setServers(resolver.servers);
        dnsResolve.resolve4(resolver.doh.hostname, { ttl: true }, (err, records) => {
            if (!!err) {
                Err(`DoH hostname resolution error`);
                reject(err);
            } else {
                Trace({ [`Resolver hostname`]: resolver.doh.hostname, [`Resolver address`]: records });
                resolver.doh.ipAddress = records.map(entry => { return entry.address; });
                resolve(resolver);
            }
        });

        // Provide the IP, and resolver parameters
    });
}

module.exports.ResolveDNSQuery = resolveQuery;
