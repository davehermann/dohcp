// Node/NPM modules
const os = require(`os`);
// Application modules
const { LogLevels, Dev, Trace, Debug } = require(`./logging`),
    { DHCPServer } = require(`./dhcp/dhcp`),
    { DNSServer } = require(`./dns/dns`);
// JSON data
const configuration = require(`../configuration.json`);

// Set the global logging level
global.logLevel = !!configuration.logLevel ? LogLevels[configuration.logLevel] : LogLevels[`warn`];

Dev({ [`Configuration`]: configuration });
Trace({ [`Found network interfaces`]: os.networkInterfaces() });

let configInUse = buildConfiguration(configuration),
    pServerLaunch = Promise.resolve();

Debug({ [`Active configuration`]: configInUse });

if (!!configInUse.dhcp && !configInUse.dhcp.disabled)
    pServerLaunch = pServerLaunch
        .then(() => DHCPServer(configInUse));

if (!!configInUse.dns && !configInUse.dns.disabled)
    pServerLaunch = pServerLaunch
        .then(() => DNSServer(configInUse));

function buildConfiguration(configuration) {
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
            interfaceAddresses
                .filter(i => { return i.family == `IPv4`; })
                .forEach(i => { computedConfig.ipv4Addresses.push(i); });

            // Repeat the primary IP setting to use the defined interface
            if (computedConfig.ipv4Addresses.length > 0)
                computedConfig.serverIpAddress = computedConfig.ipv4Addresses[0].address;
        }
    }

    return computedConfig;
}
