// Node/NPM modules
const dgram = require(`dgram`),
    https = require(`https`);
// Application modules
const { LogLevels, Dev, Trace, Debug, Info, Err } = require(`../logging`);

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

            lookupInDns(msg)
                .then(response => {
                    Trace({ [`Complete Response`]: response.toString(`hex`) });
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
    return new Promise((resolve, reject) => {
        let request = {
            hostname: `cloudflare-dns.com`,
            method: `POST`,
            path: `/dns-query`,
            headers: {
                [`Content-Type`]: `application/dns-udpwireformat`,
                [`Content-Length`]: msg.length,
            }
        };

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
}

module.exports.DNSServer = startServer;
