// Application Modules
import { IClientIdentifier } from "../../../interfaces/configuration/dhcp";
import { DHCPOptions } from "../rfc2132/dhcpOptions";

/** Contract for allocated address for in-memory and persistent usage */
interface IAllocatedAddress {
    /** Unique identifier string provided by the client */
    clientId: string;
    /** Allocated IP address */
    ipAddress: string;
    /** Address allocation has been confirmed by/to client */
    isConfirmed: boolean;
    /** Start time (millisecond) for the lease */
    leaseStart: number;
    /** Hostname provided by the client */
    providedHost: string;
    /** Hostname provided by static assignment configuration from the server */
    staticHost: string;
}

/**
 * TypeGuard for AllocatedAddress class' constructor
 * @param hostOrClientId - The first parameter passed into the constructor
 */
function isIAllocatedAddress(hostOrClientId: IAllocatedAddress | IClientIdentifier): hostOrClientId is IAllocatedAddress {
    return (hostOrClientId as IAllocatedAddress).clientId !== undefined;
}

/** Allocated host information */
class AllocatedAddress implements IAllocatedAddress {
    /**
     * Create a new address record
     * @param hostOrClientId - The host information (when reading from persistent storage) or unique client identifier for the allocation
     * @param configuredPoolLeaseSeconds - The lease length configured for the address pool
     * @param isConfirmed - Address allocation has been confirmed by/to client *(Default: **false**)*
     */
    constructor(hostOrClientId: IAllocatedAddress | IClientIdentifier, configuredPoolLeaseSeconds: number, public isConfirmed = false) {
        if (isIAllocatedAddress(hostOrClientId)) {
            this.clientIdentification = DHCPOptions.decodeClientIdentifier(hostOrClientId.clientId);
            this.ipAddress = hostOrClientId.ipAddress;
            this.isConfirmed = hostOrClientId.isConfirmed;
            this.leaseStartTime = new Date(hostOrClientId.leaseStart);
            this.providedHost = hostOrClientId.providedHost;
            this.staticHost = hostOrClientId.staticHost;
        } else {
            this.clientIdentification = hostOrClientId;
        }

        this.maximumLeaseLengthMilliseconds = configuredPoolLeaseSeconds * 1000;
    }

    /** Decoded client identification */
    private readonly clientIdentification: IClientIdentifier;
    /** Was the allocation lease set within the current active runtime of this server? */
    private inSession = false;
    /** Start time of the lease */
    private leaseStartTime: Date = null;
    /** Configured lease length */
    private readonly maximumLeaseLengthMilliseconds: number = null;
    /** Configured expiration time for a lease, independent of start time + pool lease length */
    private leaseExpirationTime: Date = null;

    //#region Public IAllocatedAddress properties

    /** Unique identifier string provided by the client */
    public get clientId(): string { return this.clientIdentification.uniqueId; }
    /** Allocated IP address */
    public ipAddress: string = null;
    /** Start time (millisecond) for the lease */
    public get leaseStart(): number { return this.leaseStartTime.getTime(); }
    /** Hostname provided by the client */
    public providedHost: string = null;
    /** Hostname provided by static assignment configuration from the server */
    public staticHost: string = null;

    //#endregion Public IAllocatedAddress properties

    /** The XID of the last client DHCP message involving this allocation */
    public lastMessageId: number;
    /** Configured expiration time for a lease, independent of start time + pool lease length */
    public get leaseExpirationTimestamp(): Date { return this.leaseExpirationTime; }

    /**
     * The hostname to use for the client
     *   + The statically defined name if one exists
     *   + The client-provided name if no static name is defined
     */
    public get hostname(): string {
        if (!!this.staticHost)
            return this.staticHost;

        return this.providedHost;
    }

    /**
     * Configure an expiration date/time
     * @param currentTime - The time to use as the start time of the lease
     * @param leaseSeconds - The length of time for the lease
     *
     * @remarks
     * _Overrides the standard lease start + pool length_
     */
    public SetExpiration(currentTime: Date, leaseSeconds: number): void {
        this.leaseExpirationTime = new Date(currentTime.getTime() + (leaseSeconds * 1000));
    }

    public toJSON(): unknown {
        return {
            clientId: this.clientId,
            ipAddress: this.ipAddress,
            isConfirmed: this.isConfirmed,
            leaseStart: this.leaseStart,
            providedHost: this.providedHost,
            staticHost: this.staticHost,
        };
    }
}

export {
    AllocatedAddress,
};
