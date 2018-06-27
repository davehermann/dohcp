#!/usr/bin/env node

// Application modules
const { ParseArguments } = require(`./arguments`),
    { GenerateConfiguration } = require(`./configuration`),
    { PrintHelp } = require(`./help`),
    { InstallService, RemoveService } = require(`./service`);

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
    dhcp: {
        description: `[Work-in-progress] Report on current status of DHCP server`,
    },
};

const actionsToPerform = ParseArguments(definedActions);
runActions()
    .catch(err => {
        // eslint-disable-next-line no-console
        console.log(err);
    });

function runActions() {
    if (actionsToPerform.length > 0) {
        let action = actionsToPerform.shift();

        return definedActions[action.name].method(action, definedActions)
            .then(() => runActions());
    } else
        return Promise.resolve();
}
