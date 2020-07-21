// Node Modules
import * as os from "os";

// Application Modules
import { IConfiguration } from "../interfaces/configuration/configurationFile";
import { FilterIPs } from "../server/addressing";

function buildConfiguration(configuration: IConfiguration, dnsResolvers?: any): IConfiguration {
    // Copy the configuration
    const computedConfig: IConfiguration = JSON.parse(JSON.stringify(configuration)),
        interfaces = os.networkInterfaces();

    // Set the primary IP of this server to the first IP found
    // Maybe this should scan for the IP matching the subnet defined by the DHCP subnet mask and pool ranges?
    for (const interfaceName in interfaces)
        if (interfaceName != `lo`) {
            computedConfig.serverIpAddress = interfaces[interfaceName].filter(addr => { return addr.family == `IPv4`; })[0].address;
            break;
        }

    // Expand the interfaces
    let ipv4Addresses: Array<os.NetworkInterfaceInfo> = [];
    if (!!configuration.interface) {
        const interfaceAddresses = interfaces[configuration.interface];

        if (!!interfaceAddresses) {
            ipv4Addresses = FilterIPs(interfaceAddresses);

            // Repeat the primary IP setting to use the defined interface
            if (ipv4Addresses.length > 0)
                computedConfig.serverIpAddress = ipv4Addresses[0].address;
        }
    }
    computedConfig.ipv4Addresses = ipv4Addresses;

    if (!!configuration.dns && !!dnsResolvers)
        // Add the upstream configuration
        computedConfig.dns.upstream = dnsResolvers;

    return computedConfig;
}

export {
    buildConfiguration as BuildConfiguration,
};
