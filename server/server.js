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
    let computedConfig = JSON.parse(JSON.stringify(configuration));

    // Expand the interfaces
    computedConfig.ipv4Addresses = [];
    if (!!configuration.interface) {
        let interfaceAddresses = os.networkInterfaces()[configuration.interface];

        if (!!interfaceAddresses)
            interfaceAddresses
                .filter(i => { return i.family == `IPv4`; })
                .forEach(i => { computedConfig.ipv4Addresses.push(i); });
    }

    return computedConfig;
}
