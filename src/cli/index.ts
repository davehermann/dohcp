import { ParseArguments } from "./arguments";
import { PrintHelp } from "./help";
import { GenerateConfiguration } from "./configuration";
import { IAction, IActionToTake } from "../interfaces/configuration/cliArguments";

/** Configure the list of recognized CLI arguments */
function buildActions() {
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

    return definedActions;
}

/**
 * Run each action described by the CLI parameters used
 * @param actionsToPerform - List of found actions
 * @param definedActions - List of all recognized possible actions
 * @param configuration - Service configuration
 */
async function runActions(actionsToPerform: Array<IActionToTake>, definedActions: Map<string, IAction>, configuration: any) {
    if (actionsToPerform.length > 0) {
        const action = actionsToPerform.shift();

        // if (definedActions[action.name].usesConfiguration)
        //     pAction = loadConfiguration();

        await definedActions.get(action.name).method(action, definedActions, configuration);
        await runActions(actionsToPerform, definedActions, configuration);
    }
}

// function loadConfiguration() {
//     if (!!configuration)
//         return Promise.resolve();

//     return LoadFile(`./configuration.json`)
//         .then(contents => { return JSON.parse(contents); })
//         .then(config => BuildConfiguration(config))
//         .then(config => {
//             configuration = config;

//             // Add the remote host
//             configuration.dataServiceHost = dataServiceHost || configuration.serverIpAddress;
//         });
// }

/** Initialize the CLI */
async function initialize(): Promise<void> {
    const definedActions = buildActions();
    const { actionsToTake, dataServiceHost } = ParseArguments(definedActions);

    // let configuration = null;

    await runActions(actionsToTake, definedActions, null);
}

initialize()
    .catch(err => {
        console.error(err);
    });
