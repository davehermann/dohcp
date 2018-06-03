// Node/NPM modules
const dgram = require(`dgram`);
// Application modules
const { Allocations } = require(`./allocations`),
    { DHCPMessage } = require(`./dhcpMessage`),
    { DHCPOptions } = require(`./rfc2132`),
    { LogLevels, Trace, Debug, Info, Err } = require(`../logging`);

const SERVER_PORT = 67,
    CLIENT_PORT = 68,
    BROADCAST_IP = `255.255.255.255`;
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

        server.setBroadcast(true);
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

        let pResponse = Promise.resolve();

        switch (message.options.dhcpMessageType) {
            case `DHCPDISCOVER`:
                pResponse = offerAddress(message);
                break;

            case `DHCPREQUEST`:
                // Only process is the client message identifies this server
                if (message.options.serverIdentifier == _configuration.serverIpAddress)
                    pResponse = confirmAddress(message);
                else
                    Debug(`Not targeted at ${_configuration.serverIpAddress}`);
                break;
        }

        pResponse
            .then(sendMessage => {
                if (!!sendMessage)
                    // Send the message
                    return new Promise((resolve, reject) => {
                        Debug(`Sending message: ${sendMessage.dhcpMessage.options.dhcpMessageType}`);
                        server.send(sendMessage.dhcpMessage.binaryMessage, CLIENT_PORT, sendMessage.toBroadcast ? BROADCAST_IP : sendMessage.toIP, (err) => {
                            if (!!err)
                                reject(err);
                            else
                                resolve();
                        });
                    });
            })
            .catch(err => {
                Err(`Error in DHCP response processing`);
                Err(err, true);
            });
    });

    // On any error, log the error, but do not close the socket
    server.on(`error`, (err) => {
        Err(`An error has occurred`);
        Err(err, true);
        // server.close();
    });

    // Bind to all interfaces until Node has a way to filter by source interface
    // server.bind({ port: SERVER_PORT, address: ipAddress });
    server.bind(SERVER_PORT);
}

function confirmAddress(dhcpRequestMessage) {
    Trace(`Confirming address request`);
    return _allocations.ConfirmAddress(dhcpRequestMessage)
        .then(assignment => {
            if (!!assignment) {
                Trace(`Has assigned address`);

                // Send an ACK message
                let dhcpAcknowledge = new DHCPMessage();

                dhcpAcknowledge.GenerateReply(dhcpRequestMessage, assignment, _configuration);
                dhcpAcknowledge.options.dhcpMessageType = DHCPOptions.byProperty.dhcpMessageType.valueMap[`5`];

                // Encode the binary message
                dhcpAcknowledge.Encode();
                Trace({
                    hex: dhcpAcknowledge.toString(),
                    data: dhcpAcknowledge
                });

                return Promise.resolve({ dhcpMessage: dhcpAcknowledge, toBroadcast: true });
            } else {
                Trace(`No assigned address`);
                // Send an NACK
            }
        });
}

function offerAddress(dhcpDiscoverMessage) {
    return _allocations.OfferAddress(dhcpDiscoverMessage)
        .then(assignment => {
            if (!!assignment) {
                // Send a DHCP Offer back to the client
                let dhcpOfferMessage = new DHCPMessage();

                dhcpOfferMessage.GenerateReply(dhcpDiscoverMessage, assignment, _configuration);
                dhcpOfferMessage.options.dhcpMessageType = DHCPOptions.byProperty.dhcpMessageType.valueMap[`2`];

                // Encode the binary message
                dhcpOfferMessage.Encode();
                Trace({
                    hex: dhcpOfferMessage.toString(),
                    data: dhcpOfferMessage
                });

                // Send back to the client
                return Promise.resolve({ dhcpMessage: dhcpOfferMessage, toBroadcast: true });
            }
            // TO DO: Handle responses when all addresses in a pool have been assigned
            else {
                return null;
            }
        });
}

module.exports.DHCPServer = startServer;
