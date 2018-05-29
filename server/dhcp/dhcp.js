// Node/NPM modules
const dgram = require(`dgram`);
// Application modules
const { DhcpStack } = require(`./protocolStack`),
    { Trace, Debug, Info, Error } = require(`../logging`);

const SERVER_PORT = 67;

function startServer(configuration) {
    ipv4DHCP(configuration);
}

function ipv4DHCP(configuration) {
    // Bind to the UDP port for a DHCP server, and exclusively to the addresses specified
    if (configuration.ipv4Addresses.length > 0)
        configuration.ipv4Addresses.forEach(addressData => newV4DhcpSocket(addressData.address));
    else
        newV4DhcpSocket();
}

function newV4DhcpSocket(ipAddress) {
    let server = dgram.createSocket({ type: `udp4` });

    // When the server starts listening
    server.on(`listening`, () => {
        const address = server.address();
        Info({ address });
    });

    // Every time a message is received
    server.on(`message`, (msg, rinfo) => {
        let dhcpOperation = new DhcpStack(msg, rinfo);
    });

    // On any error, log the error, but do not close the socket
    server.on(`error`, (err) => {
        Error(`An error has occurred`);
        Error(err);
        // server.close();
    });

    server.bind({ port: SERVER_PORT, address: ipAddress });
}

module.exports.DHCPServer = startServer;
