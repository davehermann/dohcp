#!/usr/bin/env node

// NPM Modules
import { InstallService, RemoveService } from "@davehermann/systemd-unit-installer";

// Application Modules
import { ParseArguments } from "./arguments";
import { PrintHelp } from "./help";
import { GenerateConfiguration } from "./configuration";
import { QueryLeases as DhcpQueryLeases } from "./dhcp/lease-query";
import { QueryCache as DnsQueryCache } from "./dns/cache-query";
import { IAction, IActionToTake } from "../interfaces/configuration/cliArguments";
import { IConfiguration } from "../interfaces/configuration/configurationFile";
import { LoadConfiguration } from "../server/configuration";

/** Configure the list of recognized CLI arguments */
function buildActions() {
    /** Map of CLI parameter, and the action it will trigger */
    const definedActions: Map<string, IAction> = new Map();

    definedActions.set(`help`, {
        aliases: [`--help`, `-h`, `-?`],
        description: `Print this information`,
        method: PrintHelp,
    });
    definedActions.set(`init`, {
        description: `Generate a basic configuration file`,
        method: GenerateConfiguration,
    });
    definedActions.set(`install`, {
        description: `Install as a Linux-systemd service (run via 'sudo')`,
        additionalArguments: 1,
        argumentsDescription: [
            { arg: `--no-start`, detail: `Only generate the .service file and symlink. Do not start/enable the service.` },
        ],
        method: InstallService,
    });
    definedActions.set(`remove`, {
        description: `Remove as an installed service (run via 'sudo')`,
        method: RemoveService,
    });

    definedActions.set(`dns-cache`, {
        aliases: [`dns`],
        description: `Show local DNS cache results`,
        additionalArguments: 1,
        argumentsDescription: [
            { arg: `--all`, detail: `Include all forwarded DNS cache entries`},
            { arg: `--by-address`, detail: `Sort DNS entries by the IP address (LOCAL-ONLY)`},
        ],
        method: DnsQueryCache,
        usesConfiguration: true,
    });

    definedActions.set(`dhcp-leases`, {
        aliases: [`dhcp`],
        description: `List active (unexpired) DHCP leases assigned since last service start`,
        additionalArguments: 1,
        argumentsDescription: [
            { arg: `--active`, detail: `Include any active (unexpired) leases assigned prior to last restart` },
            { arg: `--previously-seen`, detail: `Include expired leases that have previously been assigned` },
            { arg: `--all-known`, detail: `Include any configured leases that have not ever been assigned by the service` },
        ],
        method: DhcpQueryLeases,
        usesConfiguration: true,
    });

    /**
     * TBD
     * dhcp-decode
     * dhcp-reset
     * dhcp-test
     * dhcp-history
     */

    return definedActions;
}

/**
 * Run each action described by the CLI parameters used
 * @param actionsToPerform - List of found actions
 * @param definedActions - List of all recognized possible actions
 * @param configuration - Service configuration
 */
async function runActions(actionsToPerform: Array<IActionToTake>, definedActions: Map<string, IAction>, configuration: IConfiguration, dataServiceHost: string) {
    if (actionsToPerform.length > 0) {
        const action = actionsToPerform.shift();

        if (definedActions.get(action.name).usesConfiguration && !configuration)
            configuration = await LoadConfiguration(dataServiceHost);

        await definedActions.get(action.name).method(action, definedActions, configuration);
        await runActions(actionsToPerform, definedActions, configuration, dataServiceHost);
    }
}

/** Initialize the CLI */
async function initialize(): Promise<void> {
    const definedActions = buildActions();
    const { actionsToTake, dataServiceHost } = ParseArguments(definedActions);

    // let configuration = null;

    await runActions(actionsToTake, definedActions, null, dataServiceHost);
}

initialize()
    .catch(err => {
        // eslint-disable-next-line no-console
        console.error(err);
    });
