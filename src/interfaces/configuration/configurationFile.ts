import { NetworkInterfaceInfo } from "os";

import { IConfiguration as IDhcpConfiguration } from "./dhcp";
import { IConfiguration as IDnsConfiguration } from "./dns";

/** Configuration File Object Interface */
interface IConfiguration {
    /** The logging level for the entire service */
    logLevel: string;
    /** The network interface name used by the service */
    interface: string;
    /** DHCP configuration */
    dhcp: IDhcpConfiguration;
    /** DNS configuration */
    dns: IDnsConfiguration;
    /** Hostname or IP for the running service */
    dataServiceHost?: string;
    /** IP address assigned to the first interface on this system */
    serverIpAddress?: string;
    /** IPv4 Address information for the interface */
    ipv4Addresses?: Array<NetworkInterfaceInfo>;
}

export {
    IConfiguration,
};
