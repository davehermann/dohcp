// Node Modules
import * as dgram from "dgram";
import { NetworkInterfaceInfo } from "os";

// NPM Modules
import { Info, Err, Trace, Dev, Debug, GetConfiguredLogging, LogLevels, Log } from "multi-level-logger";

// Application Modules
import { Addressing } from "./allocation/allocate";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { DHCPMessage } from "./dhcpMessage";
import { DHCPHistory } from "./history";
import { AllocatedAddress } from "./allocation/AllocatedAddress";

interface IClientReply {
    dhcpMessage: DHCPMessage;
    sendViaBroadcastAddress?: boolean;
    sendToIP?: string;
}

const DHCP_SERVER_PORT = 67,
    CLIENT_PORT = 68,
    BROADCAST_IP = `255.255.255.255`;


async function startServer(configuration: IConfiguration): Promise<void> {
    Info(`Starting DHCP Server`, { logName: `dhcp` });

    const ipv4 = new IPv4DHCP(configuration);
    ipv4.Start();
}

/** DHCP Service */
class IPv4DHCP {
    constructor(private readonly configuration: IConfiguration) {}

    private addressing: Addressing = new Addressing(this.configuration);

    /**
     * Bind the service to all network interfaces/IPs from configuration
     * @param remainingAddresses - List of all Network Interfaces - from configuration - to bind the service to
     */
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

    /**
     * Start listening to DHCP requests on the specified interface
     * @param ipAddress - The interface to listen on
     *
     * @remarks - Node.JS **does not** support determining individual interface sources for broadcast messages
     *   + The NodeJS dgram `.addMembership()` method is blocked for the DHCP broadcast address (255.255.255.255) on many (maybe all?) OSes as it's outside of the [multicast address space](https://www.iana.org/assignments/multicast-addresses/multicast-addresses.xhtml)
     *   + NodeJS does not have a way to provide the local interface a UDP message is received on
     *     + [This exact DHCP scenario](https://github.com/nodejs/node-v0.x-archive/issues/8788#issuecomment-74446986) has been discussed for years in prior iterations of NodeJS development, and [discussion continues](https://github.com/nodejs/node/issues/1649) as part of active NodeJS development.
     *     + Until NodeJS begins supporting interface source, this cannot be resolved
     */
    private async newSocket(ipAddress: NetworkInterfaceInfo) {
        const server = dgram.createSocket({ type: `udp4` });
        let bindingSucceeded = false;

        server.on(`message`, async (msg, rinfo) => {
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
                Dev({
                    [`Re-encoded message`]: hexadecimalMessage,
                    [`Re-encode matches Decode`]: hexadecimalMessage == msg.toString(`hex`).substr(0, hexadecimalMessage.length),
                    [`Re-encode == Decode`]: hexadecimalMessage == msg.toString(`hex`),
                }, { logName: `dhcp` });
            }

            Debug({ [`Decoded message`]: message }, { logName: `dhcp` });

            let replyToClient: IClientReply = null;

            switch (message.messageType) {
                case `DHCPDISCOVER`:
                    replyToClient = await this.respondToDiscover(message);
                    break;

                case `DHCPREQUEST`:
                    replyToClient = await this.respondToRequest(message);
                    break;
            }

            // Track the message in the client's history
            DHCPHistory.AddMessage(message, replyToClient?.dhcpMessage);

            if (!!replyToClient) {
                // Send the message to the client
                Debug(`Sending message: ${replyToClient.dhcpMessage.messageType}`, { logName: `dhcp` });

                if (process.env.NO_REPLY === `true`)
                    Log(`DHCP reply blocked by NO_REPLY environment variable. DHCP Message:\n${replyToClient.dhcpMessage.toString()}`);
                else
                    server.send(replyToClient.dhcpMessage.asData, CLIENT_PORT, replyToClient.sendViaBroadcastAddress ? BROADCAST_IP : replyToClient.sendToIP, err => {
                        if (!!err) {
                            Err(`Error in DHCP response processing`, { logName: `dhcp` });
                            Err({ [`Client message`]: message.toString() }, { logName: `dhcp` });
                            Err(err, { logName: `dhcp` });
                        }
                    });
            }
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

    /**
     * In response to a DHCPREQUEST message, confirm the assigned address and reply with a DHCPACK message
     * @param requestMessage - The client-sent DHCPREQUEST message
     */
    private async confirmAddress(requestMessage: DHCPMessage): Promise<IClientReply> {
        Trace(`Confirming address request for ${requestMessage.clientIdentifier.uniqueId}`, { logName: `dhcp` });

        const assignedAddress = await this.addressing.ConfirmClientAddress(requestMessage);

        Dev({ [`Allocated Address`]: assignedAddress }, { logName: `dhcp` });

        if (!!assignedAddress) {
            Trace(`${requestMessage.clientHardwareIdentifier} has assigned address`, { logName: `dhcp` });

            // Generate a DHCPACK message for the client
            return { dhcpMessage: this.generateDHCPReply(requestMessage, assignedAddress, `DHCPACK`), sendViaBroadcastAddress: true };
        } else {
            Trace(`No assigned address in response to DHCPREQUEST from ${requestMessage.clientHardwareIdentifier}`, { logName: `dhcp` });

            // Deregister address
            return this.deregisterClient(requestMessage);
        }
    }

    /**
     * Allocate an address, and generate a DHCPOFFER message in reply
     * @param discoverMessage - DHCPDISCOVER message sent by a client
     */
    private async respondToDiscover(discoverMessage: DHCPMessage): Promise<IClientReply> {
        Trace(`Responding to DHCPDISCOVER message`, { logName: `dhcp` });

        const assignment = await this.addressing.OfferToClient(discoverMessage);

        Dev({ [`Allocated Address`]: assignment }, { logName: `dhcp` });

        if (!!assignment)
            // Generate a DHCPOFFER for the client
            return { dhcpMessage: this.generateDHCPReply(discoverMessage, assignment, `DHCPOFFER`), sendViaBroadcastAddress: true };

        return null;
    }

    /**
     * Create a reply message for a client
     * @param message - The source message from a client
     * @param assignedAddress - The address allocation assigned to the client
     * @param replyType - The DHCP message type for the reply
     */
    private generateDHCPReply(message: DHCPMessage, assignedAddress: AllocatedAddress, replyType: string): DHCPMessage {
        // Create a DHCP reply for the client
        const replyMessage = new DHCPMessage();

        // Set the message type to the reply type
        replyMessage.GenerateReply(message, assignedAddress, this.configuration, replyType);

        // Encode the message
        replyMessage.Encode();

        // Debug information
        replyType = replyType.replace(/^DHCP/, ``);
        const debugIdentifier = `${replyType.substr(0, 1)}${replyType.substr(1).toLowerCase()}`;
        Trace({ [`Encoded ${debugIdentifier}`]: replyMessage.toString(), [`${debugIdentifier} data`]: replyMessage }, { logName: `dhcp` });

        return replyMessage;
    }

    /**
     * Confirm an address issued by this server
     * @param requestMessage - DHCPREQUEST message sent by a client
     */
    private async respondToRequest(requestMessage: DHCPMessage): Promise<IClientReply> {
        Trace(`Responding to DHCPREQUEST message`, { logName: `dhcp` });

        // When no server identifier is included
        if (!requestMessage.serverIdentifier) {
            Dev(`No server identifier in DHCP message. Attempting to match request to allocation...`, { logName: `dhcp` });

            // Confirm the address requested for the client matches what is assigned here
            const requestMatchesAllocation = await this.addressing.MatchRequestToAllocation(requestMessage);

            // If it matches, confirm the address, and if not deregister
            let replyToClient: IClientReply;

            if (requestMatchesAllocation)
                replyToClient = await this.confirmAddress(requestMessage);
            else
                replyToClient = await this.deregisterClient(requestMessage);

            return replyToClient;
        } else if (requestMessage.serverIdentifier == this.configuration.serverIpAddress)
            return await this.confirmAddress(requestMessage);
        else
            Debug(`DHCPREQUEST Message targeting ${requestMessage.serverIdentifier}. This server is ${this.configuration.serverIpAddress}. Ending response processing.`, { logName: `dhcp` });
    }

    /**
     * Track an unsuccessful address allocation, and alert the client
     * @param message - Client-generated DHCP message
     */
    private async deregisterClient(message: DHCPMessage): Promise<IClientReply> {
        if (this.configuration.dhcp.authoritative) {
            // Note and track the deregistration
            Debug(`Deregistering ${message.clientIdentifier.uniqueId}`, { logName: `dhcp` });
            DHCPHistory.TrackDeregistration(message);

            // Create an allocation holder, with an IP of 0.0.0.0
            const unallocatedAddress = new AllocatedAddress(message.clientIdentifier, this.configuration.dhcp.leases.pool.leaseSeconds);
            unallocatedAddress.ipAddress = `0.0.0.0`;

            // Send a DHCPNAK message to the client
            return { dhcpMessage: this.generateDHCPReply(message, unallocatedAddress, `DHCPNAK`), sendViaBroadcastAddress: true };
        }

        return null;
    }

    /** Start the DHCP service */
    public async Start() {
        await this.addressing.Allocate();

        await this.bindServer();
    }
}

export {
    startServer as DHCPServer,
};
