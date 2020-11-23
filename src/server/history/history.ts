import * as dgram from "dgram";
import { DNSMessage } from "../dns/rfc1035/dnsMessage";
import { Trace, Dev, Warn } from "multi-level-logger";

import { IDNSEventStream, DNSEvent } from "./dnsEvent";
import { IClientDeregistration, DHCPEvent, TrackedDeregistration as DHCPDeregistration } from "./dhcpEvent";
import { DHCPMessage } from "../dhcp/dhcpMessage";
import { AllocatedAddress } from "../dhcp/allocation/AllocatedAddress";

const MAXIMUM_DNS_CLIENT_REQUESTS = 1000,
    MAXIMUM_EVENTS_STORED_PER_CLIENT = 250,
    DEREGISTRATION_REMOVAL_TIME = 30000;

interface IDHCPClient {
    clientId: string;
    lastIP?: string;
}

class ClientHistory {
    private readonly dnsRequests: Array<DNSEvent> = [];
    private readonly dhcpRequests: Map<string, Array<DHCPEvent>> = new Map();
    private readonly deregistrations: Map<string, IClientDeregistration> = new Map();

    //#region DNS

    public AddDnsRequest(source: dgram.RemoteInfo, message: DNSMessage): void {
        message.questions.forEach(q => {
            // Find and existing event in the list
            const idxDnsEvent = this.dnsRequests.findIndex(request => (request.question == q.label) && (request.ipAddress == source.address));
            let dnsEvent: DNSEvent;

            if (idxDnsEvent >= 0) {
                // Remove it from the list if it exists
                dnsEvent = this.dnsRequests.splice(idxDnsEvent, 1)[0];
            } else {
                Trace(`Tracking DNS request from ${source.address} for ${q.label}`);
                // Create a new event if it doesn't
                dnsEvent = new DNSEvent();
                dnsEvent.question = q.label;
                dnsEvent.ipAddress = source.address;
            }

            // Track the request
            Dev(`Track for ${dnsEvent.question} from ${dnsEvent.ipAddress} added`);
            dnsEvent.requests.push(new Date());

            // Drop the first request if the event list is too long
            if (dnsEvent.requests.length > MAXIMUM_EVENTS_STORED_PER_CLIENT) {
                Dev(`Oldest track for ${dnsEvent.question} from ${dnsEvent.ipAddress} removed`);
                dnsEvent.requests.shift();
            }

            // Place the event at the end of the requests list
            this.dnsRequests.push(dnsEvent);

            // Drop the first item from the request list if it's too long
            if (this.dnsRequests.length > MAXIMUM_DNS_CLIENT_REQUESTS) {
                const oldestRequest = this.dnsRequests.shift();
                Trace(`Dropping DNS request history for ${oldestRequest.question} from ${oldestRequest.ipAddress}`);
            }
        });
    }

    public GetDnsByIp(ipAddress: string): Array<DNSEvent> {
        const recordsForIp = this.dnsRequests.filter(req => (req.ipAddress == ipAddress));

        return recordsForIp;
    }

    public GetIpsInDnsHistory(): Array<string> {
        const ipList = this.dnsRequests.map(request => request.ipAddress);
        return [...new Set(ipList)];
    }

    //#endregion DNS

    //#region DHCP

    /**
     * Add an event to a client's tracked event list
     * @param clientId - Unique identifier for the client
     * @param eventData - Event details to add to the list
     */
    private addDhcpEvent(clientId: string, eventData: DHCPEvent) {
        // Get the event list for the client ID
        if (!this.dhcpRequests.has(clientId))
            this.dhcpRequests.set(clientId, []);

        const eventList = this.dhcpRequests.get(clientId);

        // Add the event to the list
        eventList.push(eventData);

        // Drop the earliest events when the event size surpasses the maximum
        while(eventList.length > MAXIMUM_EVENTS_STORED_PER_CLIENT)
            eventList.shift();
    }

    /**
     * Add a client address allocation
     * @param message - The original DHCP message from the client
     * @param assignedAddress - The address allocation provided to the client
     * @param hostnameInDns - The hostname used in DNS for the client
     */
    public AddDHCPAssignment(message: DHCPMessage, assignedAddress: AllocatedAddress, hostnameInDns: string): void {
        const newAssignment = new DHCPEvent();
        newAssignment.ipAddress = assignedAddress.ipAddress;
        newAssignment.dnsHostname = hostnameInDns;
        this.addDhcpEvent(message.clientHardwareIdentifier, newAssignment);
    }

    /**
     * Add client-server messaging communication
     * @param clientMessage - The DHCP message sent from the client
     * @param serverResponse - The generated reply sent from this service back to the client
     */
    public AddDHCPMessage(clientMessage: DHCPMessage, serverResponse: DHCPMessage): void {
        const newMessage = new DHCPEvent();
        newMessage.clientMessage = clientMessage;
        newMessage.serverResponse = serverResponse;
        this.addDhcpEvent(clientMessage.clientHardwareIdentifier, newMessage);
    }

    /**
     * Track a client deregistration to provide warnings on the server if the client does not reset upon receipt of a DHCPNAK message
     * @param message - The DHCP message from the client
     */
    public TrackDHCPDeregistration(message: DHCPMessage): void {
        const track = new DHCPDeregistration();
        track.xid = message.clientMessageId;
        track.clientId = message.clientHardwareIdentifier;
        track.hostname = message.clientProvidedHostname;
        track.vendorId = message.vendorClassIdentifier;

        let clientDeregistrations = this.deregistrations.get(track.clientId);
        if (!clientDeregistrations) {
            clientDeregistrations = { tracks: [], removeId: null };
            this.deregistrations.set(track.clientId, clientDeregistrations);
        }

        if (!!clientDeregistrations.removeId)
            clearTimeout(clientDeregistrations.removeId);

        if (clientDeregistrations.tracks.length > 0) {
            let message = `Client not resetting on DHCPNAK`
                + ` (${clientDeregistrations.tracks.length} time${clientDeregistrations.tracks.length !== 1 ? `s` : ``})`
                + `: ${track.clientId}`;

            if (!!track.hostname)
                message += ` - host: ${track.hostname}`;
            else if (!!track.vendorId)
                message += ` - vendor: ${track.vendorId}`;

            Warn(message, { logName: `dhcp` });
        }

        clientDeregistrations.tracks.push(track);

        clientDeregistrations.removeId = setTimeout(() => { this.deregistrations.delete(track.clientId); }, DEREGISTRATION_REMOVAL_TIME);
    }

    public GetDhcpHistoryForClient(clientId: string): Array<DHCPEvent> {
        return this.dhcpRequests.get(clientId);
    }

    public GetClientsInDHCPHistory(): Array<IDHCPClient> {
        const clientList: Array<IDHCPClient> = [];
        for (const [clientId, dhcpEvents] of this.dhcpRequests.entries()) {
            clientList.push({ clientId });

            for (let idx = dhcpEvents.length - 1; idx >= 0; idx--)
                if (!!dhcpEvents[idx].ipAddress) {
                    clientList[clientList.length - 1].lastIP = dhcpEvents[idx].ipAddress;
                    break;
                }
        }

        return clientList;
    }

    //#endregion DHCP
}

export {
    IDNSEventStream,
    DNSEvent,
    ClientHistory,
};
