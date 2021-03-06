import { NetworkInterfaceInfo } from "os";

import { IConfiguration as IDhcpConfiguration } from "./dhcp";
import { IConfiguration as IDnsConfiguration } from "./dns";
import { IConfiguration as IWebServerConfiguration } from "./web";

/** Configuration File Object Interface */
interface IConfiguration {
    /** Last time the service started */
    serviceStart?: Date;
    /** The logging level for the entire service */
    logLevel: string;
    /** The network interface name used by the service */
    interface: string;
    /** DHCP configuration */
    dhcp?: IDhcpConfiguration;
    /** DNS configuration */
    dns?: IDnsConfiguration;
    /** Hostname or IP for the running service */
    dataServiceHost?: string;
    /**
     * Port to use for the data service
     *
     * @remarks
     * _Not currently assignable via configuration_
     */
    dataServicePort?: number;
    /** Web Status Configuration */
    web?: IWebServerConfiguration;
    /** IP address assigned to the first interface on this system */
    serverIpAddress?: string;
    /** IPv4 Address information for the interface */
    ipv4Addresses?: Array<NetworkInterfaceInfo>;
}

export {
    IConfiguration,
};
