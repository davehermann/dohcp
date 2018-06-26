#!/usr/bin/env node

// Application modules
const { ParseArguments } = require(`./arguments`),
    { PrintHelp } = require(`./help`),
    { InstallService, RemoveService } = require(`./service`);

const definedActions = {
    help: {
        aliases: [`--help`, `-h`, `-?`],
        description: `Print this information`,
        method: PrintHelp,
    },
    install: {
        description: `Install as a Linux-systemd service`,
        method: InstallService,
    },
    remove: {
        description: `Remove as an installed service`,
        method: RemoveService,
    },
};

const actionsToPerform = ParseArguments(definedActions);

actionsToPerform.forEach(action => {
    definedActions[action.name].method(action, definedActions);
});
