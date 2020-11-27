import { IConfiguration as IDnsResolvers } from "./dnsResolvers";

enum eDnsClass {
    /** The Internet */
    IN = 1,
}
enum eDnsType {
    /** IPv4 Host address */
    A = 1,
    /** Canonical name for an alias */
    CNAME = 5,
    /** IPv6 Host address */
    AAAA = 28,
}

interface ICacheId {
    label: string;
    typeId: eDnsType;
    classId: eDnsClass;
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
    /** Configuration for upstream DNS resolvers
     *   - *From: ~/dns-resolvers.json*
     */
    upstream?: IDnsResolvers;
}

/** Label in a DNS message */
interface ILabel {
    value: string;
    offset: number;
}

/** A host registered in the local DNS */
interface IRegisteredHost {
    /** The domain name entry */
    name: string;
    /** An IP address pointing to the host */
    ip?: string;
    /** An alias (CNAME) pointing to another host record */
    alias?: string;
}

export {
    eDnsClass,
    eDnsType,
    ICacheId,
    IConfiguration,
    ILabel,
    IRegisteredHost,
};
