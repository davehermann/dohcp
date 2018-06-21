// Node/NPM modules
const https = require(`https`),
    { Resolver } = require(`dns`);

// Application modules
const { AddToCache, FindInCache } = require(`./cache`),
    { DNSMessage } = require(`./rfc1035/dnsMessage`),
    { Dev, Trace, Debug, Warn, Err } = require(`../logging`);

function resolveQuery2(dnsQuery, configuration) {
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
                if (lastAnswer.typeId == 5) {
                    let subQuery = new DNSMessage();
                    subQuery.AddQuestions([lastAnswer.rdata[0]]);
                    subQuery.Generate();

                    pAnswer = resolveQuery2(subQuery, configuration)
                        .then(subAnswer => {
                            answer.AddAnswers(subAnswer.answers);

                            return answer;
                        });
                }

                // With the expanded answers, create a new response message
                pAnswer = pAnswer
                    .then(answer => {
                        let dnsAnswer = new DNSMessage();
                        dnsAnswer.AddQuestions(dnsQuery.questions.map(q => { return q.label; }));
                        dnsAnswer.AddAnswers(answer.answers);

                        dnsAnswer.Generate(dnsQuery.queryId, true, dnsQuery.rd);
                        Trace({ dnsAnswer });
                        Trace({ asHex: dnsAnswer.dnsMessage.toString(`hex`) });

                        return dnsAnswer;
                        // return answer;
                    });
            }

            return pAnswer;
        });
}

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
        let label = dnsQuery.questions[0].label,
            cacheHit = FindInCache(label);
        Debug({ label, cacheHit });
        if (!!cacheHit)
            pLookup = pLookup
                .then(() => { return respondFromCache(dnsQuery, cacheHit); });
    }

    // If cache didn't find it, return a lookup
    return pLookup
        .then(answer => { return !!answer ? answer : lookupInDns(dnsQuery, configuration); })
        .then(dnsAnswer => {
            let pAnswer = Promise.resolve(dnsAnswer);

            // If the bottom record is a CNAME, then we need to resolve the CNAME and add to the answers here
            if (dnsAnswer.answers[dnsAnswer.answers.length - 1].rrType == `CNAME`) {
                // Perform the lookup with a new query object
                let subQuery = new DNSMessage();
                subQuery.Query(dnsAnswer.answers[dnsAnswer.answers.length - 1].resourceData);

                Trace({ [`Sub-query Hex`]: subQuery.toHex(), subQuery });

                pAnswer = resolveQuery(subQuery, configuration)
                    .then(subAnswer => {
                        // Integrate all answers with the answers list in this answer
                        subAnswer.answers.forEach(a => { dnsAnswer.answers.push(a); });
                        // Update the header
                        dnsAnswer.header.GenerateHeader(dnsAnswer, dnsQuery);
                        dnsAnswer.GenerateBuffer();

                        return dnsAnswer;
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

    // let dnsAnswer = new DNSMessage();
    // dnsAnswer.ReplyFromCache(dnsQuery, cachedAnswer);
    // Trace(`Reply generated`);
    // Debug({ [`Decoded cached response as Hex`]: dnsAnswer.toHex(), [`Parsed cached response`]: dnsAnswer });
    //
    // return Promise.resolve(dnsAnswer);
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

module.exports.ResolveDNSQuery = resolveQuery2;
