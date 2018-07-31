// Node/NPM modules
const os = require(`os`);

// Application modules
const { FilterIPs } = require(`./addressing`),
    { LogLevels } = require(`./logging`);

function buildConfiguration(configuration, dnsResolvers) {
    // Copy the configuration
    let computedConfig = JSON.parse(JSON.stringify(configuration)),
        interfaces = os.networkInterfaces();

    // Set the primary IP of this server to the first IP found
    // Maybe this should scan for the IP matching the subnet defined by the DHCP subnet mask and pool ranges?
    for (let interfaceName in interfaces)
        if (interfaceName != `lo`) {
            computedConfig.serverIpAddress = interfaces[interfaceName].filter(addr => { return addr.family == `IPv4`; })[0].address;
            break;
        }

    // Expand the interfaces
    computedConfig.ipv4Addresses = [];
    if (!!configuration.interface) {
        let interfaceAddresses = interfaces[configuration.interface];

        if (!!interfaceAddresses) {
            computedConfig.ipv4Addresses = FilterIPs(interfaceAddresses);

            // Repeat the primary IP setting to use the defined interface
            if (computedConfig.ipv4Addresses.length > 0)
                computedConfig.serverIpAddress = computedConfig.ipv4Addresses[0].address;
        }
    }

    if (!!configuration.dns && !!dnsResolvers)
        // Add the upstream configuration
        computedConfig.dns.upstream = dnsResolvers;

    return computedConfig;
}

function logLevelsFromConfiguration(configuration) {
    let logLevel = {};

    logLevel.default = !!configuration && !!configuration.logLevel ? LogLevels[configuration.logLevel] : LogLevels[`warn`];
    logLevel.dhcp = !!configuration && !!configuration.dhcp && !!configuration.dhcp.logLevel ? LogLevels[configuration.dhcp.logLevel] : logLevel.default;
    logLevel.dns = !!configuration && !!configuration.dns && !!configuration.dns.logLevel ? LogLevels[configuration.dns.logLevel] : logLevel.default;

    // When running as a service, assume the service logger will supply a timestamp
    logLevel.includeTimestamp = (!process.env.IS_SERVICE || (process.env.IS_SERVICE.toLowerCase() !== `true`));

    return logLevel;
}

module.exports.BuildConfiguration = buildConfiguration;
module.exports.GetGlobalLogLevel = logLevelsFromConfiguration;
