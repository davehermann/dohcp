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

function configureLog(configuration, defaultLogLevel, configLogName) {
    const environmentVariable = `LOG${!!configLogName ? `_${configLogName.toUpperCase()}` : ``}`;
    let configObject = configuration;
    if (!!configLogName && !!configObject)
        configObject = configObject[configLogName];

    const inEV = process.env[environmentVariable],
        inConfig = !!configObject ? configObject.logLevel : null;

    return !!inEV ? LogLevels[inEV] : (!!inConfig ? LogLevels[inConfig] : defaultLogLevel);
}

function logLevelsFromConfiguration(configuration) {
    let logLevel = {};

    // Default all logging to WARN if nothing defined
    logLevel.default = configureLog(configuration, LogLevels[`warn`]);

    // Configure the sub-logs
    logLevel.dhcp = configureLog(configuration, logLevel.default, `dhcp`);
    logLevel.dns = configureLog(configuration, logLevel.default, `dns`);

    // When running as a service, assume the service logger will supply a timestamp
    logLevel.includeTimestamp = (!process.env.IS_SERVICE || (process.env.IS_SERVICE.toLowerCase() !== `true`));

    return logLevel;
}

module.exports.BuildConfiguration = buildConfiguration;
module.exports.GetGlobalLogLevel = logLevelsFromConfiguration;
