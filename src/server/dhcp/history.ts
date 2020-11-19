import { DHCPMessage } from "./dhcpMessage";
import { AllocatedAddress } from "./allocation/AllocatedAddress";
import { Warn } from "multi-level-logger";

const MAXIMUM_EVENTS_STORED_PER_CLIENT = 200,
    DEREGISTRATION_REMOVAL_TIME = 30000;

interface IClientDeregistration {
    tracks: Array<TrackedDeregistration>;
    removeId: NodeJS.Timeout;
}

/** Deregistration tracking when *not* responding to a client */
class TrackedDeregistration {
    public readonly timestamp = new Date();

    public xid: number;
    public clientId: string;
    public hostname: string;
    public vendorId: string;
}

/** Recorded DHCP event (IP assigned or message tracked) */
class DHCPEvent {
    private readonly timestamp = new Date();

    public ipAddress: string;
    public dnsHostname: string;
    public clientMessage: DHCPMessage;
    public serverResponse: DHCPMessage;
}

/** Record of DHCP actions related to each client */
class History {
    private history: Map<string, Array<DHCPEvent>> = new Map();
    private deregistrations: Map<string, IClientDeregistration> = new Map();

    /**
     * Add an event to a client's tracked event list
     * @param clientId - Unique identifier for the client
     * @param eventData - Event details to add to the list
     */
    private addEvent(clientId: string, eventData: DHCPEvent) {
        // Get the event list for the client ID
        if (!this.history.has(clientId))
            this.history.set(clientId, []);

        const eventList = this.history.get(clientId);

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
    public AddAssignment(message: DHCPMessage, assignedAddress: AllocatedAddress, hostnameInDns: string): void {
        const newAssignment = new DHCPEvent();
        newAssignment.ipAddress = assignedAddress.ipAddress;
        newAssignment.dnsHostname = hostnameInDns;
        this.addEvent(message.clientHardwareIdentifier, newAssignment);
    }

    /**
     * Add client-server messaging communication
     * @param clientMessage - The DHCP message sent from the client
     * @param serverResponse - The generated reply sent from this service back to the client
     */
    public AddMessage(clientMessage: DHCPMessage, serverResponse: DHCPMessage) {
        const newMessage = new DHCPEvent();
        newMessage.clientMessage = clientMessage;
        newMessage.serverResponse = serverResponse;
        this.addEvent(clientMessage.clientHardwareIdentifier, newMessage);
    }

    /**
     * Track a client deregistration to provide warnings on the server if the client does not reset upon receipt of a DHCPNAK message
     * @param message - The DHCP message from the client
     */
    public TrackDeregistration(message: DHCPMessage) {
        const track = new TrackedDeregistration();
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
}

const sharedHistory = new History();

export {
    sharedHistory as DHCPHistory,
};
