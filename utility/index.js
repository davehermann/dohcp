#!/usr/bin/env node

// Application modules
const { ParseArguments } = require(`./arguments`),
    { BuildConfiguration } = require(`../server/configuration`),
    { GenerateConfiguration } = require(`./configuration`),
    { PrintHelp } = require(`./help`),
    { InstallService, RemoveService } = require(`./service`),
    { LoadFile } = require(`./utilities`),
    { DNSCache } = require(`./dns/cache-query`),
    { ResetDHCP } = require(`./dhcp/reset`),
    { TestDHCP } = require(`./dhcp/test`);

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
    dns: {
        description: `[Work-in-progress] Report on current status of DNS server`,
    },
    [`dns-cache`]: {
        description: `Show local DNS cache results`,
        additionalArguments: 1,
        argumentsDescription: [
            { arg: `--all`, detail: `Include all forwarded DNS cache entries`}
        ],
        method: DNSCache,
        usesConfiguration: true,
    },
    dhcp: {
        description: `[Work-in-progress] Report on current status of DHCP server`,
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
};

const actionsToPerform = ParseArguments(definedActions);
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
        .then(config => { configuration = config; });
}
