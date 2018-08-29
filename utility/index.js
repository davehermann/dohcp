#!/usr/bin/env node

// Application modules
const { ParseArguments } = require(`./arguments`),
    { BuildConfiguration, GetGlobalLogLevel } = require(`../server/configuration`),
    { GenerateConfiguration } = require(`./configuration`),
    { PrintHelp } = require(`./help`),
    { InstallService, RemoveService } = require(`./service`),
    { LoadFile } = require(`./utilities`),
    { DHCPHistory } = require(`./dhcp/history`),
    { DHCPLeases } = require(`./dhcp/lease-query`),
    { DHCPDecode } = require(`./dhcp/message-decode`),
    { DNSCache } = require(`./dns/cache-query`),
    { ResetDHCP } = require(`./dhcp/reset`),
    { TestDHCP } = require(`./dhcp/test`);

global.logLevel = GetGlobalLogLevel();

const definedActions = {
    help: {
        aliases: [`--help`, `-h`, `-?`],
        description: `Print this information`,
        method: PrintHelp,
    },
    init: {
        description: `Generate a basic configuration file`,
        method: GenerateConfiguration,
    },
    install: {
        description: `Install as a Linux-systemd service (run via 'sudo')`,
        method: InstallService,
    },
    remove: {
        description: `Remove as an installed service (run via 'sudo')`,
        method: RemoveService,
    },
    [`dns-cache`]: {
        aliases: [`dns`],
        description: `Show local DNS cache results`,
        additionalArguments: 1,
        argumentsDescription: [
            { arg: `--all`, detail: `Include all forwarded DNS cache entries`}
        ],
        method: DNSCache,
        usesConfiguration: true,
    },
    [`dhcp-leases`]: {
        aliases: [`dhcp`],
        description: `List active (unexpired) DHCP leases assigned since last service start`,
        additionalArguments: 1,
        argumentsDescription: [
            { arg: `--active`, detail: `Include any active (unexpired) leases assigned prior to last restart` },
            { arg: `--previously-seen`, detail: `Include expired leases that have previously been assigned` },
            { arg: `--all-known`, detail: `Include any configured leases that have not ever been assigned by the service` },
        ],
        method: DHCPLeases,
        usesConfiguration: true,
    },
    [`dhcp-decode`]: {
        description: `Decode a raw (hexadecimal) DHCP message`,
        additionalArguments: 1,
        method: DHCPDecode,
    },
    [`dhcp-reset`]: {
        description: `Reset assigned address history.  BY DEFAULT: Clears used address history but not prior assigned-by-id (i.e. MAC address) history`,
        additionalArguments: 1,
        argumentsDescription: [
            { arg: `--all`, detail: `Reset assigned MAC addresses as well` },
        ],
        method: ResetDHCP,
    },
    [`dhcp-test`]: {
        description: `Test functionality for DHCP. SEE README FOR INCOMPATIBILITY WITH ROUTERS IN NODEJS.`,
        additionalArguments: 1,
        argumentsDescription: [
            { arg: `--any`, detail: `Tests for binding to all interfaces and all IPs instead of just one.`}
        ],
        method: TestDHCP,
    },
    [`dhcp-history`]: {
        description: `Get history of DHCP actions for a client ID`,
        additionalArguments: 3,
        argumentsDescription: [
            { arg: `--id`, detail: `Followed by the client ID (e.g. MAC Address). Gets the DHCP history for the client.` },
            { arg: `--all`, detail: `Use this to show all data.  By default, only 100 maximum entries are displayed.`}
        ],
        method: DHCPHistory,
        usesConfiguration: true,
    },
};

let actionsToPerform, dataServiceHost;
({ actionsToTake: actionsToPerform, dataServiceHost } = ParseArguments(definedActions));
let configuration = null;
runActions()
    .catch(err => {
        // eslint-disable-next-line no-console
        console.log(err);
    });

function runActions() {
    if (actionsToPerform.length > 0) {
        let action = actionsToPerform.shift(),
            pAction = Promise.resolve();

        if (definedActions[action.name].usesConfiguration)
            pAction = loadConfiguration();

        return pAction
            .then(() => definedActions[action.name].method(action, definedActions, configuration))
            .then(() => runActions());
    } else
        return Promise.resolve();
}

function loadConfiguration() {
    if (!!configuration)
        return Promise.resolve();

    return LoadFile(`./configuration.json`)
        .then(contents => { return JSON.parse(contents); })
        .then(config => BuildConfiguration(config))
        .then(config => {
            configuration = config;

            // Add the remote host
            configuration.dataServiceHost = dataServiceHost || configuration.serverIpAddress;
        });
}
