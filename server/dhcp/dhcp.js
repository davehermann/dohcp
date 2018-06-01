// Node/NPM modules
const dgram = require(`dgram`);
// Application modules
const { Allocations } = require(`./allocations`),
    { DHCPMessage } = require(`./dhcpMessage`),
    { DHCPOptions } = require(`./rfc2132`),
    { LogLevels, Trace, Debug, Info, Err } = require(`../logging`);

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

        let pResponse = Promise.resolve();

        switch (message.options.dhcpMessageType) {
            case `DHCPDISCOVER`:
                pResponse = offerAddress(message, ipAddress);
                break;
        }

        pResponse
            .catch(err => {
                Err(`Error in DHCP response processing`);
                Err(err, true);
            });
    });

    // On any error, log the error, but do not close the socket
    server.on(`error`, (err) => {
        Err(`An error has occurred`);
        Err(new Error(err));
        // server.close();
    });

    server.bind({ port: SERVER_PORT, address: ipAddress });
}

function offerAddress(dhcpDiscoverMessage, boundIp) {
    return _allocations.OfferAddress(dhcpDiscoverMessage)
        .then(assignment => {
            if (!!assignment) {
                // Send a DHCP Offer back to the client
                let dhcpOfferMessage = new DHCPMessage();

                dhcpOfferMessage.isReply = true;
                dhcpOfferMessage.htype = dhcpDiscoverMessage.htype;
                dhcpOfferMessage.hlen = dhcpDiscoverMessage.hlen;
                dhcpOfferMessage.hops = dhcpDiscoverMessage.hops;
                dhcpOfferMessage.xid = dhcpDiscoverMessage.xid;
                dhcpOfferMessage.secs = dhcpDiscoverMessage.secs;
                dhcpOfferMessage.flags = dhcpDiscoverMessage.flags;
                dhcpOfferMessage.ciaddr = `0.0.0.0`;
                dhcpOfferMessage.yiaddr = assignment.ipAddress;
                dhcpOfferMessage.siaddr = boundIp || `0.0.0.0`; // This server's IP
                // Ignore relays for now
                dhcpOfferMessage.giaddr = `0.0.0.0`;
                dhcpOfferMessage.chaddr = dhcpDiscoverMessage.chaddr;
                // Don't provide a hostname for this server
                dhcpOfferMessage.sname = null;
                // Don't provide a boot file path
                dhcpOfferMessage.file = null;

                // Specify the parameters the server will include as part of the response
                let serverDefinedParameters = [
                    `dhcpMessageType`,
                    `serverIdentifier`,
                    `ipAddressLeaseTime`,
                    `renewalTimeValue`,
                    `rebindingTimeValue`
                ];

                // Convert to a list of codes
                let parameters = serverDefinedParameters.map(propertyName => { Trace(propertyName); return DHCPOptions.byProperty[propertyName].code; });

                // Supply the requested parameters
                dhcpDiscoverMessage.options.parameterRequestList.forEach(param => {
                    if (parameters.indexOf(param.code) < 0)
                        parameters.push(param.code);
                });

                let options = {};

                parameters.forEach(code => {
                    let dhcpOption = DHCPOptions.byCode[code],
                        value = undefined;

                    switch (dhcpOption.propertyName) {
                        case `broadcastAddressOption`: {
                            // Value is the last address in the subnet for the client's IP
                            let mask = _configuration.dhcp.leases.pool.networkMask.split(`.`),
                                address = assignment.ipAddress.split(`.`).map((octet, idx) => { return +mask[idx] == 255 ? octet : 255; });
                            value = address.join(`.`);
                        }
                            break;
                        case `dhcpMessageType`:
                            value = DHCPOptions.byProperty.dhcpMessageType.valueMap[`2`];
                            break;
                        case `dhcpServerIdentifier`:
                            value = dhcpOfferMessage.siaddr;
                            break;
                        case `domainName`:
                            value = _configuration.dns.domain;
                            break;
                        case `domainNameServerOption`:
                            value = _configuration.dns.servers;
                            break;
                        case `ipAddressLeaseTime`:
                            value = _configuration.dhcp.leases.pool.leaseSeconds;
                            break;
                        case `rebindingTimeValue`:
                            value = Math.round(_configuration.dhcp.leases.pool.leaseSeconds * 0.875);
                            break;
                        case `renewalTimeValue`:
                            value = Math.round(_configuration.dhcp.leases.pool.leaseSeconds * 0.5);
                            break;
                        case `routerOption`:
                            value = _configuration.dhcp.routers;
                            break;
                        case `subnetMask`:
                            value = _configuration.dhcp.leases.pool.networkMask;
                            break;
                    }

                    if (value !== undefined)
                        options[dhcpOption.propertyName] = value;
                });

                dhcpOfferMessage.options = options;

                // Encode the binary message
                dhcpOfferMessage.Encode();
                Trace({
                    hex: dhcpOfferMessage.toString(),
                    data: dhcpOfferMessage
                });

                // Send back to the client
            }
            // TO DO: Handle responses when all addresses in a pool have been assigned
            else {
                return null;
            }
        });
}

module.exports.DHCPServer = startServer;
