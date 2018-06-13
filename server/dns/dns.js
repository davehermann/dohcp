// Node/NPM modules
const dgram = require(`dgram`),
    https = require(`https`),
    { Resolver } = require(`dns`);
// Application modules
const { DNSMessage } = require(`./rfc1035/dnsMessage`),
    { Dev, Trace, Debug, Info, Err } = require(`../logging`);

const DNS_SERVER_PORT = 53;

let _configuration = null;

function startServer(config) {
    Debug(`Starting DNS Server`);

    _configuration = config;

    return dns();
}

function dns(remainingAddresses) {
    // Step through servers configuration
    // Any entry that is "primaryIP", or an IP on the configured interface, will listen for DNS
    if (remainingAddresses === undefined)
        remainingAddresses = _configuration.dns.servers.filter(ip => {
            return (ip == `primaryIP`) || (_configuration.ipv4Addresses.map(addr => { return addr.address; }).indexOf(ip) >= 0);
        }).map(ip => {
            return (ip == `primaryIP`) ? _configuration.serverIpAddress : ip;
        });

    Dev({ remainingAddresses });
    if (remainingAddresses.length > 0) {
        return newDNSSocket(remainingAddresses.shift())
            .then(() => dns(remainingAddresses));
    } else
        return Promise.resolve();
}

function newDNSSocket(ipAddress) {
    return new Promise((resolve, reject) => {
        let server = dgram.createSocket({ type: `udp4` }),
            bindingSucceeded = false;

        server.on(`listening`, () => {
            const address = server.address();
            Info({ address });

            bindingSucceeded = true;
            resolve();
        });

        // Every time a message is received
        server.on(`message`, (msg, rinfo) => {
            Trace({
                [`Remote address information`]: rinfo,
                [`Hexadecimal message`]: msg.toString(`hex`)
            });

            let message = new DNSMessage();
            message.Decode(msg);
            Debug({ [`Decoded DNS Query`]: message });

            lookupInDns(msg)
                .then(response => {
                    Trace({ [`Complete Response`]: response.toString(`hex`) });
                    let responseMessage = new DNSMessage();
                    responseMessage.Decode(response);
                    Debug(responseMessage);

                    // Cache the response based on the TTLs

                    return response;
                })
                .then(response => {
                    // Send response
                    server.send(response, rinfo.port, rinfo.address);
                })
                .catch(err => {
                    Err(err);
                });
        });

        server.on(`error`, (err) => {
            Err(`An error has occurred`);
            Err(err, true);

            // If the error was on binding, reject the Promise
            if (!bindingSucceeded)
                reject(err);
        });

        // Bind to the IP
        server.bind({ port: DNS_SERVER_PORT, address: ipAddress });
    });
}

function lookupInDns(msg) {
    return resolveDnsHost()
        .then(dohResolver => {
            Trace(`Retrieving DNS`);

            return new Promise((resolve, reject) => {
                let request = {
                    hostname: dohResolver.doh.ipAddress[0],
                    path: dohResolver.doh.path,
                    headers: {
                        [`Host`]: dohResolver.doh.hostname,
                        [`Content-Length`]: msg.length,
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

                req.write(msg);
                req.end();
            });
        });
}

function resolveDnsHost() {
    return new Promise((resolve, reject) => {
        // Check configuration for the resolver to use
        let resolver = _configuration.dns.upstream.resolvers.filter(resolver => { return resolver.name == _configuration.dns.upstream.primary; })[0];

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

module.exports.DNSServer = startServer;
