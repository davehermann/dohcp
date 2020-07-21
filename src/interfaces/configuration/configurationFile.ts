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
}

export {
    IConfiguration,
};
