// Node/NPM modules
const dgram = require(`dgram`);
// Application modules
const { DNSMessage } = require(`./rfc1035/dnsMessage`),
    { ResolveDNSQuery } = require(`./resolver`),
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

            let dnsQuery = new DNSMessage(msg);
            Debug({ [`Decoded as Hex`]: dnsQuery.toHex(), [`Decoded Query`]: dnsQuery });

            ResolveDNSQuery(dnsQuery, _configuration)
                .then(dnsAnswer => {
                    Debug(`Sending response`);
                    // Send response
                    server.send(dnsAnswer.buffer, rinfo.port, rinfo.address);
                })
                .catch(err => {
                    Err(err, true);
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

module.exports.DNSServer = startServer;
