import { ParseArguments, Action, ActionToTake } from "./arguments";
import { PrintHelp } from "./help";

function buildActions() {
    const definedActions: Map<string, Action> = new Map();
    definedActions.set(`help`, {
        aliases: [`--help`, `-h`, `-?`],
        description: `Print this information`,
        method: PrintHelp,
    });
    // definedActions.set(`init`, {
    //     description: `Generate a basic configuration file`,
    //     method: GenerateConfiguration,
    // });

    return definedActions;
}

async function runActions(actionsToPerform: Array<ActionToTake>, definedActions: Map<string, Action>, configuration: any) {
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

async function initialize() {
    const definedActions = buildActions();
    const { actionsToTake, dataServiceHost } = ParseArguments(definedActions);

    // let configuration = null;

    await runActions(actionsToTake, definedActions, null);

}

initialize()
    .catch(err => {
        console.error(err);
    });
