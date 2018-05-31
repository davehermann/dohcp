// Node/NPM modules
const dgram = require(`dgram`);
// Application modules
const { Allocations } = require(`./allocations`),
    { DHCPMessage } = require(`./dhcpMessage`),
    { LogLevels, Trace, Debug, Info, Error } = require(`../logging`);

const SERVER_PORT = 67;
let _configuration = null,
    _allocations = null;

function startServer(config) {
    _configuration = config;
    _allocations = new Allocations(_configuration);

    ipv4DHCP();
}

function ipv4DHCP() {
    // Bind to the UDP port for a DHCP server, and exclusively to the addresses specified
    if (_configuration.ipv4Addresses.length > 0)
        _configuration.ipv4Addresses.forEach(addressData => newV4DhcpSocket(addressData.address));
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
        Trace({
            [`Remote address information`]: rinfo,
            [`Hexadecimal message`]: msg.toString(`hex`)
        });

        let message = new DHCPMessage();
        message.Decode(msg);

        // Encode the message, and compare, for testing
        if (global.logLevel <= LogLevels[`trace`]) {
            message.Encode();
            Trace({ [`Encoded hex message`]: message.toString() });
        }

        Debug({ [`Decoded message`]: message });

        switch (message.options.dhcpMessageType) {
            case `DHCPDISCOVER`:
                offerAddress(message);
                break;
        }
    });

    // On any error, log the error, but do not close the socket
    server.on(`error`, (err) => {
        Error(`An error has occurred`);
        Error(err);
        // server.close();
    });

    server.bind({ port: SERVER_PORT, address: ipAddress });
}

function offerAddress(dhcpMessage) {
    let assignment = _allocations.OfferAddress(dhcpMessage);
}

module.exports.DHCPServer = startServer;
