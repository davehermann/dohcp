/** A host registered in the local DNS */
interface IRegisteredHost {
    /** The domain name entry */
    name: string;
    /** An IP address pointing to the host */
    ip?: string;
    /** An alias (CNAME) pointing to another host record */
    alias?: string;
}

/** DNS Configuration */
interface IConfiguration {
    /** Disable DNS service */
    disabled?: boolean;
    /**
     * List of DNS servers providing name resolution
     *   - **primaryIP** uses the IP address for the configured network interface for this service
     */
    servers?: Array<string>;
    /** TLD to append to all hostnames registered with this service */
    domain?: string;
    /** Preconfigured domain name assignments */
    records?: Array<IRegisteredHost>;
}

export {
    IConfiguration,
};
