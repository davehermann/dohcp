// Node/NPM modules
const os = require(`os`);
// Application modules
const { FilterIPs } = require(`./addressing`),
    { LogLevels, Dev, Trace, Debug } = require(`./logging`),
    { DHCPServer } = require(`./dhcp/dhcpServer`),
    { DNSServer } = require(`./dns/dnsServer`);
// JSON data
const configuration = require(`../configuration.json`),
    dnsResolvers = require(`../dns-resolvers.json`);

// Set the global logging level
global.logLevel = !!configuration.logLevel ? LogLevels[configuration.logLevel] : LogLevels[`warn`];

Dev({ [`Configuration`]: configuration, [`DNS Resolution`]: dnsResolvers });
Trace({ [`Found network interfaces`]: os.networkInterfaces() });

let configInUse = null;

Promise.resolve()
    .then(() => buildConfiguration())
    .then(useConfiguration => {
        configInUse = useConfiguration;
        Debug({ [`Active configuration`]: configInUse });
    })
    .then(() => {
        if (!!configInUse.dhcp && !configInUse.dhcp.disabled)
            return DHCPServer(configInUse);
    })
    .then(() => {
        if (!!configInUse.dns && !configInUse.dns.disabled)
            return DNSServer(configInUse);
    });

function buildConfiguration() {
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

    if (!!configuration.dns)
        // Add the upstream configuration
        computedConfig.dns.upstream = dnsResolvers;

    return computedConfig;
}
