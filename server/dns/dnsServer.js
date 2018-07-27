// Node/NPM modules
const dgram = require(`dgram`);
// Application modules
const { LoadPreconfiguredRecords } = require(`./cache`),
    { DNSMessage } = require(`./rfc1035/dnsMessage`),
    { ResolveDNSQuery } = require(`./resolver`),
    { Dev, Trace, Debug, Info, Err } = require(`../logging`);

const DNS_SERVER_PORT = 53;

let _configuration = null;

function startServer(config) {
    Info(`Starting DNS Server`, `dns`);

    _configuration = config;

    LoadPreconfiguredRecords(config);

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

    Dev({ remainingAddresses }, `dns`);
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
            Info({ [`Binding address`]: address }, `dns`);

            bindingSucceeded = true;
            resolve();
        });

        // Every time a message is received
        server.on(`message`, (msg, rinfo) => {
            let timestamp = new Date(),
                newDenotation = ` New Query `,
                denotationMask = 45;

            // For Debug or lower levels, add a separator line
            Debug(newDenotation.padStart(newDenotation.length + denotationMask, `-`).padEnd(newDenotation.length + (denotationMask * 2), `-`), `dns`);

            Trace({
                [`Remote address information`]: rinfo,
                [`Hexadecimal query`]: msg.toString(`hex`),
            }, `dns`);

            let dnsQuery = new DNSMessage();
            dnsQuery.FromDNS(msg);
            Trace({ dnsQuery }, `dns`);

            ResolveDNSQuery(dnsQuery, _configuration, rinfo)
                .then(dnsAnswer => {
                    Info(`DNS Query (${rinfo.address}) - ${dnsQuery.queryId} - ${(new Date()).getTime() - timestamp.getTime()}ms - ${dnsQuery.questions.map(q => { return q.label; }).join(`, `)}: ${dnsAnswer.answers.map(a => { return a.summary; }).join(`, `)}`, `dns`);
                    // Send response
                    server.send(dnsAnswer.dnsMessage, rinfo.port, rinfo.address);
                })
                .catch(err => {
                    Err(err, true, `dns`);
                });
        });

        server.on(`error`, (err) => {
            Err(`An error has occurred`, `dns`);
            Err(err, true, `dns`);

            // If the error was on binding, reject the Promise
            if (!bindingSucceeded)
                reject(err);
        });

        // Bind to the IP
        server.bind({ port: DNS_SERVER_PORT, address: ipAddress });
    });
}

module.exports.DNSServer = startServer;
