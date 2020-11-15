// Node Modules
import * as dgram from "dgram";
import { NetworkInterfaceInfo } from "os";

// NPM Modules
import { Info, Err, Trace, Dev, Debug, GetConfiguredLogging, LogLevels } from "multi-level-logger";

// Application Modules
import { Addressing } from "./allocation/allocate";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { DHCPMessage } from "./dhcpMessage";

const DHCP_SERVER_PORT = 67,
    CLIENT_PORT = 68,
    BROADCAST_IP = `255.255.255.255`;


async function startServer(configuration: IConfiguration): Promise<void> {
    Info(`Starting DHCP Server`, { logName: `dhcp` });

    const ipv4 = new IPv4DHCP(configuration);
    ipv4.Start();
}

class IPv4DHCP {
    constructor(private readonly configuration: IConfiguration) {}

    private addressing: Addressing = new Addressing(this.configuration);

    private async bindServer(remainingAddresses?: Array<NetworkInterfaceInfo>) {
        if (remainingAddresses === undefined) {
            remainingAddresses = this.configuration.ipv4Addresses.filter(() => true);

            if (remainingAddresses.length == 0)
                remainingAddresses.push(null);
        }

        if (remainingAddresses.length > 0) {
            await this.newSocket(remainingAddresses.shift());
            await this.bindServer(remainingAddresses);
        }
    }

    private async newSocket(ipAddress: NetworkInterfaceInfo) {
        const server = dgram.createSocket({ type: `udp4` });
        let bindingSucceeded = false;

        server.on(`message`, (msg, rinfo) => {
            Trace({
                [`Remote address information`]: rinfo,
                [`Hexadecimal message`]: msg.toString(`hex`)
            }, { logName: `dhcp` });

            const message = new DHCPMessage();
            message.Decode(msg);

            // When testing, encode the message
            const currentLogging = GetConfiguredLogging();
            if (currentLogging.logLevel[`dhcp`] <= LogLevels.trace) {
                message.Encode();
                const hexadecimalMessage = message.toString();
                Trace({
                    [`Encoded message`]: hexadecimalMessage,
                    [`Re-encode matches Decode`]: hexadecimalMessage == msg.toString(`hex`).substr(0, hexadecimalMessage.length),
                    [`Re-encode == Decode`]: hexadecimalMessage == msg.toString(`hex`),
                }, { logName: `dhcp` });
            }

            Debug({ [`Decoded message`]: message }, { logName: `dhcp` });
        });

        return new Promise((resolve, reject) => {
            // When the server starts listening
            server.on(`listening`, () => {
                const address = server.address();
                Info({ [`DHCP listening`]: address }, { logName: `dhcp` });

                server.setBroadcast(true);

                bindingSucceeded = true;
                resolve();
            });

            // On any error, log the error, but do not close the socket
            server.on(`error`, (err) => {
                Err(`An error has occurred`, { logName: `dhcp` });
                Err(err, { logName: `dhcp` });

                // If the error was on binding, reject the Promise
                if (!bindingSucceeded)
                    reject(err);
            });

            // Bind to all interfaces until Node has a way to filter by source interface
            // server.bind({ port: DHCP_SERVER_PORT, address: ipAddress });
            server.bind(DHCP_SERVER_PORT);
        });
    }

    public async Start() {
        await this.addressing.Allocate();

        await this.bindServer();
    }
}

export {
    startServer as DHCPServer,
};
