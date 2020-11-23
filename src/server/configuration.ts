// Node Modules
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

// NPM Modules
import { InitializeLogging, Dev, Trace } from "multi-level-logger";

// Application Modules
import { IConfiguration } from "../interfaces/configuration/configurationFile";
import { IConfiguration as IDnsResolver } from "../interfaces/configuration/dnsResolvers";
import { IStaticAssignment } from "../interfaces/configuration/dhcp";
import { FilterIPs } from "../server/addressing";

/** Path to the application configuration JSON file */
const CONFIGURATION_FILE = path.join(__dirname, `..`, `..`, `configuration.json`),
    DNS_RESOLVERS_FILE = path.join(__dirname, `..`, `..`, `dns-resolvers.json`);

/**
 * Let environment variables set/override configuration settings
 * @param computedConfig - The configuration for the server
 */
function environmentVariableSettings(computedConfig: IConfiguration) {
    if (process.env.DHCP_DISABLED === `true` && !!computedConfig.dhcp)
        computedConfig.dhcp.disabled = true;

    if (process.env.DNS_DISABLED === `true` && !!computedConfig.dns)
        computedConfig.dns.disabled = true;

    if (!!process.env.DHCP_NO_REPLY && !!computedConfig.dhcp)
        computedConfig.dhcp.blockDhcpReplyMessages = (process.env.DHCP_NO_REPLY.toLowerCase() === `true`);

    if (!!process.env.DHCP_NO_PERSIST && !!computedConfig.dhcp)
        computedConfig.dhcp.writeToDisk = (process.env.DHCP_NO_PERSIST.toLowerCase() !== `true`);

    if (!!process.env.WEB_CACHE)
        computedConfig.web.staticCache = (process.env.WEB_CACHE !== `false`);

    if (!!process.env.WEB_PORT)
        computedConfig.web.port = +process.env.WEB_PORT;
}

function buildConfiguration(configuration: Record<string, unknown>, dnsResolvers: IDnsResolver): IConfiguration {
    // Copy the configuration
    const computedConfig: IConfiguration = JSON.parse(JSON.stringify(configuration)),
        interfaces = os.networkInterfaces();

    environmentVariableSettings(computedConfig);

    Trace({ [`Found network interfaces`]: os.networkInterfaces() });

    // Set the primary IP of this server to the first IP found
    // Maybe this should scan for the IP matching the subnet defined by the DHCP subnet mask and pool ranges?
    for (const interfaceName in interfaces)
        if (interfaceName != `lo`) {
            computedConfig.serverIpAddress = interfaces[interfaceName].filter(addr => { return addr.family == `IPv4`; })[0].address;
            break;
        }

    // Expand the interfaces
    let ipv4Addresses: Array<os.NetworkInterfaceInfo> = [];
    if (!!computedConfig.interface) {
        const interfaceAddresses = interfaces[computedConfig.interface];

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

    // Convert the DHCP static leases to a Map
    const staticLeasesAsObject = computedConfig.dhcp?.leases?.static;
    if (!!staticLeasesAsObject) {
        const staticMap: Map<string, IStaticAssignment> = new Map();

        for (const [key, value] of Object.entries(staticLeasesAsObject))
            staticMap.set(key, (value as IStaticAssignment));


        computedConfig.dhcp.leases.static = staticMap;
    }

    if (!computedConfig.web)
        computedConfig.web = {};
    if (!computedConfig.web.port)
        computedConfig.web.port = 8080;

    return computedConfig;
}

async function loadConfiguration(dataServiceHost?: string): Promise<IConfiguration> {
    // Load configuration
    Dev(`Loading configuration from file`);
    const contents = await fs.readFile(CONFIGURATION_FILE, { encoding: `utf8` });
    const config: Record<string, unknown> = JSON.parse(contents);

    // If logging is set via environment variable, generate a dummy config object
    if (!!process.env.LOG_LEVEL) {
        const logConfig = { logLevel: process.env.LOG_LEVEL };
        InitializeLogging(logConfig);
    } else
        // Pass the loaded config object to the logger
        InitializeLogging(config);

    // Load upstream resolvers
    const resolversFileContents = await fs.readFile(DNS_RESOLVERS_FILE, { encoding: `utf8` });
    const resolvers: IDnsResolver = JSON.parse(resolversFileContents);

    Dev({ [`Configuration`]: config, [`DNS Resolution`]: resolvers });

    const configuration = buildConfiguration(config, resolvers);

    // Add the remote host
    configuration.dataServiceHost = dataServiceHost || configuration.serverIpAddress;
    configuration.dataServicePort = 45332;

    return configuration;
}

export {
    CONFIGURATION_FILE,
    loadConfiguration as LoadConfiguration,
};
