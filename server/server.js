// Node/NPM modules
const os = require(`os`);
// Application modules
const { BuildConfiguration, GetGlobalLogLevel } = require(`./configuration`),
    { Dev, Trace, Debug } = require(`./logging`),
    { DataServer } = require(`./control/server`),
    { DHCPServer } = require(`./dhcp/dhcpServer`),
    { DNSServer } = require(`./dns/dnsServer`);

// JSON data
const configuration = require(`../configuration.json`),
    dnsResolvers = require(`../dns-resolvers.json`);

// Set the global logging level
global.logLevel = GetGlobalLogLevel(configuration);

Dev({ [`Configuration`]: configuration, [`DNS Resolution`]: dnsResolvers });
Trace({ [`Found network interfaces`]: os.networkInterfaces() });

let configInUse = null;

Promise.resolve()
    .then(() => BuildConfiguration(configuration, dnsResolvers))
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
    })
    .then(() => {
        return DataServer(configInUse);
    });
