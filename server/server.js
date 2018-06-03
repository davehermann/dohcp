// Node/NPM modules
const os = require(`os`);
// Application modules
const { LogLevels, Trace } = require(`./logging`),
    { DHCPServer } = require(`./dhcp/dhcp`);
// JSON data
const configuration = require(`../configuration.json`);

// Set the global logging level
global.logLevel = !!configuration.logLevel ? LogLevels[configuration.logLevel] : LogLevels[`warn`];

Trace({ [`Configuration`]: configuration });
Trace({ [`Found network interfaces`]: os.networkInterfaces() });

let configInUse = buildConfiguration(configuration);

if (!!configInUse.dhcp)
    DHCPServer(configInUse);

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
