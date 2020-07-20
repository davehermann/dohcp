// Node/NPM modules
const https = require(`https`),
    dgram = require(`dgram`);

// Application modules
const { AddToCache, FindInCache, GenerateCacheId } = require(`./cache`),
    { DNSMessage } = require(`./rfc1035/dnsMessage`),
    { Dev, Trace, Debug, Info, Warn, Err } = require(`../logging`);

function resolveQuery(dnsQuery, configuration, requestSource, useDNSoverHTTPS = true) {
    let skipAnswerProcessing = false,
        pLookup = Promise.resolve();

    // Log queries with more than one question to warn, and don't cache or rewrite the answers
    if (dnsQuery.qdcount !== 1) {
        Warn({ [`MULTI-QUESTION QUERY (unexpected)`]: dnsQuery }, `dns`);
        skipAnswerProcessing = true;
    }

    // Log queries for not internet class to warn, and don't rewrite the answers
    if (dnsQuery.questions.filter(q => { return q.classId !== 1; }).length > 0) {
        Warn({ [`NOT 'IN' CLASS QUERY (unexpected)`]: dnsQuery }, `dns`);
        skipAnswerProcessing = true;
    }

    // Check cache first, but only for single-question queries
    if (dnsQuery.qdcount === 1) {
        let label = dnsQuery.questions[0].label,
            cacheId = GenerateCacheId(dnsQuery.questions[0]),
            cacheHit = FindInCache(cacheId);
        Debug({ label, cacheId, cacheHit }, `dns`);
        if (!!cacheHit)
            pLookup = respondFromCache(dnsQuery, cacheHit);
    }

    // If cache didn't find it, return a lookup
    return pLookup
        .then(answer => { return !!answer ? answer : lookupInDns(dnsQuery, configuration, useDNSoverHTTPS); })
        .then(answer => {
            let pAnswer = Promise.resolve(answer);

            // Non-standard queries will return as-resolved
            if (!skipAnswerProcessing) {
                // If the last answer in the answer's list is a CNAME, perform a sub-query
                let lastAnswer = answer.answers[answer.answers.length - 1];
                if (!lastAnswer)
                    Info({ [`NO lastAnswer`]: dnsQuery.questions, requestSource }, `dns`);

                if (!!lastAnswer && (lastAnswer.typeId == 5)) {
                    let subQuery = new DNSMessage();
                    subQuery.AddQuestions([lastAnswer.rdata[0]]);
                    subQuery.Generate();

                    pAnswer = resolveQuery(subQuery, configuration, requestSource)
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
                            Trace({ dnsAnswer }, `dns`);
                            Trace({ asHex: dnsAnswer.dnsMessage.toString(`hex`) }, `dns`);

                            return dnsAnswer;
                        }
                    });
            }

            return pAnswer;
        });
}

function respondFromCache(dnsQuery, cachedAnswer) {
    Trace(`Responding from cache`, `dns`);
    Dev({ dnsQuery, cachedAnswer }, `dns`);

    // Create a new message
    let dnsAnswer = new DNSMessage();
    // Add this answer
    dnsAnswer.AddAnswers([cachedAnswer]);

    return Promise.resolve(dnsAnswer);
}

function lookupInDns(dnsQuery, configuration, useDNSoverHTTPS) {
    Trace(`Forwarding to public resolver`, `dns`);

    let pResolve;
    if (useDNSoverHTTPS)
        pResolve = lookupViaDNSoverHTTPS(dnsQuery, configuration);
    else
        pResolve = lookupViaDNS(dnsQuery, configuration);

    return pResolve
        .then(response => {
            Trace({ [`Complete Response`]: response.toString(`hex`) }, `dns`);

            let dnsAnswer = new DNSMessage();
            dnsAnswer.FromDNS(response);
            Debug({ dnsAnswer }, `dns`);

            // Do not cache Authoritative responses
            if (dnsAnswer.nscount == 0)
                AddToCache(dnsAnswer);

            return Promise.resolve(dnsAnswer);
        });
}

function lookupViaDNSoverHTTPS(dnsQuery, configuration) {
    return resolveDohHost(configuration)
        .then(dohResolver => {
            Trace(`Resolving query in forward DNS`, `dns`);

            return new Promise((resolve, reject) => {
                let request = {
                    hostname: dohResolver.ips[0],
                    path: dohResolver.resolver.doh.path,
                    headers: {
                        [`Host`]: dohResolver.resolver.doh.hostname,
                        [`Content-Length`]: dnsQuery.dnsMessage.length,
                    },
                };

                let useMethod = dohResolver.resolver.doh.methods.filter(method => { return method.method == dohResolver.resolver.doh.defaultMethod; })[0];

                request.method = useMethod.method;
                useMethod.headers.forEach(header => {
                    for (let name in header)
                        request.headers[name] = header[name];
                });

                Dev({ [`DoH request`]: request }, `dns`);

                let req = https.request(request, (res) => {
                    Trace({ [`DoH response`]: { status: res.statusCode, headers: res.headers } }, `dns`);

                    let data = [];

                    res.on(`data`, chunk => {
                        // chunk is a buffer
                        Dev({ [`Data chunk`]: chunk.toString(`hex`) }, `dns`);
                        data.push(chunk.toString(`hex`));
                    });

                    res.on(`end`, () => {
                        Dev({ data }, `dns`);
                        resolve(Buffer.from(data.join(``), `hex`));
                    });
                });

                req.on(`error`, (err) => {
                    Err(err, `dns`);
                    reject(err);
                });

                req.write(dnsQuery.dnsMessage);
                req.end();
            });
        });
}

function lookupViaDNS(dnsQuery, configuration) {
    // Check configuration for the resolver to use
    let resolver = configuration.dns.upstream.resolvers.filter(resolver => { return resolver.name == configuration.dns.upstream.primary; })[0];

    // Resolve the hostname (may be in cache, or perform a DNS lookup)
    return new Promise((resolve, reject) => {
        let client = dgram.createSocket({ type: `udp4` });

        client.on(`listening`, () => {
            Trace(`DNS query via UDP listening on ${JSON.stringify(client.address())}`, `dns`);
            Dev({ dnsQuery }, `dns`);

            client.send(dnsQuery.dnsMessage, 53, resolver.servers[0]);
        });

        client.on(`message`, (msg, rinfo) => {
            Debug({ [`DNS response`]: { rinfo, msg } }, `dns`);

            client.close();
            resolve(msg);
        });

        client.on(`error`, (err) => {
            Warn({ [`DNS query via UDP error`]: err, dnsQuery }, `dns`);

            client.close();
            reject(err);
        });

        // Assign a random port
        let portRange = [49152, 65535],
            randomPort = Math.round(Math.random() * (portRange[1] - portRange[0])) + portRange[0];

        // client.bind({ port: randomPort });
        // Use 0
        client.bind({ port: 0 });
    });
}

function resolveDohHost(configuration) {
    // Use the built-in DNS querying to resolve the DoH server name

    // Check configuration for the resolver to use
    let resolver = configuration.dns.upstream.resolvers.filter(resolver => { return resolver.name == configuration.dns.upstream.primary; })[0];

    Trace({ [`Loading resolver`]: resolver }, `dns`);

    // Create a DNS Query
    let resolverQuery = new DNSMessage();
    resolverQuery.AddQuestions([resolver.doh.hostname]);
    resolverQuery.Generate();

    return resolveQuery(resolverQuery, configuration, null, false)
        .then(resolverAnswer => {
            Trace({ resolverAnswer }, `dns`);

            // Return the resolver object, plus the IP(s)
            let resolverIPs = [];
            resolverAnswer.answers.forEach(answer => {
                answer.rdata.forEach(ip => {
                    if (resolverIPs.indexOf(ip) < 0)
                        resolverIPs.push(ip);
                });
            });

            return { resolver, ips: resolverIPs };
        });
}

module.exports.ResolveDNSQuery = resolveQuery;
