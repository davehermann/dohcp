// Node/NPM modules
const dgram = require(`dgram`);

// Application modules
const { TABS, SelectInterface } = require(`../shared`),
    { FilterIPs } = require(`../../server/addressing`);

const DHCP_SERVER_PORT = 67,
    CLIENT_PORT = 68,
    BROADCAST_IP = `255.255.255.255`;

function testBinding() {
    console.log(`\nTesting binding for DHCP.\n`)
    // Load the network interfaces
    return SelectInterface()
        .then(interfaceDetails => {
            // eslint-disable-next-line no-console
            console.log(`\nIf the bind is successful, use [CTRL-C] to exit testing`);
            // eslint-disable-next-line no-console
            console.log(`\nNOTE: As this is binding to DHCP, make sure all other DHCP services on this server are stopped`);
            // eslint-disable-next-line no-console
            console.log(`Any DHCP request on the subnet will echo here, but be ignored.`);

            // eslint-disable-next-line no-console
            console.log(`\n------ Possible bind errors ------`);
            // eslint-disable-next-line no-console
            console.log(`${TABS}EACCES: You may need escalated privileges. Try running with 'sudo'.`);
            // eslint-disable-next-line no-console
            console.log(`${TABS}EADDRINUSE: Is there another DHCP service operating on this server?`);
            // eslint-disable-next-line no-console
            console.log(`${TABS}EINVAL: Listening on ${BROADCAST_IP} is blocked by the system.`);

            // Perform the same filter as the server initialization
            return FilterIPs(interfaceDetails.addresses);
        })
        .then(ipv4Addresses => ipv4DHCP(ipv4Addresses));
}

// Bind to the UDP port for a DHCP server, and exclusively to the addresses specified
function ipv4DHCP(remainingAddresses) {
    if (remainingAddresses.length > 0)
        return newV4DhcpSocket(remainingAddresses.shift().address)
            .then(() => ipv4DHCP(remainingAddresses));
    else
        return Promise.resolve();
}

function newV4DhcpSocket(ipAddress) {
    // eslint-disable-next-line no-console
    console.log(`\nAttempting bind to ${ipAddress}:${DHCP_SERVER_PORT}...`);

    return new Promise((resolve, reject) => {
        let server = dgram.createSocket({ type: `udp4` }),
            bindingSucceeded = false;

        // When the server starts listening
        server.on(`listening`, () => {
            const address = server.address();
            // eslint-disable-next-line no-console
            console.log({ [`Successful bind`]: address });

            // eslint-disable-next-line no-console
            console.log(`Attempting to also listen to ${BROADCAST_IP} broadcast on the interface...`);

            // server.setBroadcast(true);
            server.addMembership(BROADCAST_IP);

            bindingSucceeded = true;
            resolve();
        });

        // Every time a message is received
        server.on(`message`, (msg, rinfo) => {
            // eslint-disable-next-line no-console
            console.log({
                [`Remote address information`]: rinfo,
                [`Hexadecimal message`]: msg.toString(`hex`)
            });
        });

        // On any error, log the error, but do not close the socket
        server.on(`error`, (err) => {
            // eslint-disable-next-line no-console
            console.error(`\n------ An error has occurred ------`);

            if (bindingSucceeded)
                // eslint-disable-next-line no-console
                console.error(new Error(err));

            // If the error was on binding, reject the Promise
            else
                reject(err);
        });

        // Bind to all interfaces until Node has a way to filter by source interface
        server.bind({ port: DHCP_SERVER_PORT, address: ipAddress });
    });
}

module.exports.TestDHCP = testBinding;
