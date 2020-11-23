import { DHCPMessage } from "../dhcp/dhcpMessage";

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

export {
    IClientDeregistration,
    DHCPEvent,
    TrackedDeregistration,
};
