interface IClientIdentifier {
    uniqueId: string;
    type?: string;
    address?: string;
}

interface IRequestedParameter {
    code: number;
    name: string;
}

/** Assign a host to a static address */
interface IStaticAssignment {
    /** Static IP to use */
    ip: string;
    /** Hostname to assign in DNS */
    hostname?: string;
}

/** Start and end IP address ranges for the pool assignments */
interface IRange {
    /** Starting IP address for a range */
    start: string;
    /** Ending IP address for a range */
    end: string;
}

interface IPool {
    /** Number of seconds before a lease expires */
    leaseSeconds: number;
    /** Subnet mask of the network */
    networkMask: string;
    /** List of start/end ranges for address assignments */
    ranges: Array<IRange>;
}

/** Lease Management */
interface ILeases {
    /** The pool of available IP addresses */
    pool: IPool;
    /** Map of MAC address keys to static assignments */
    static: Map<string, IStaticAssignment>;
}

/** DHCP Configuration */
interface IConfiguration {
    /** Disable DHCP service */
    disabled?: boolean;
    /**
     * Is this authoritative?
     *   - *In most cases, this should be* **true**
     */
    authoritative?: boolean;
    /** IPs for network gateway devices */
    routers?: Array<string>;
    /** Lease configuration */
    leases?: ILeases;
}

export {
    IClientIdentifier,
    IConfiguration,
    IRange,
    IRequestedParameter,
    IStaticAssignment,
};
