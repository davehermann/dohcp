import { IAction, IActionToTake, IFoundAction } from "../interfaces/configuration/cliArguments";

function findAction(definedActions: Map<string, IAction | string>, argument: string): IFoundAction {
    let action = definedActions.get(argument);

    if (!action)
        return { action: null, argument: null };

    if (typeof action == `string`)
        return findAction(definedActions, action);
    else
        return { action, argument };
}

function parseArguments(definedActions: Map<string, IAction | string>) {
    // Copy the CLI arguments to a new array
    const args = process.argv.filter(() => { return true; });
    let actionsToTake: Array<IActionToTake> = [],
        dataServiceHost: string = null;

    // Add any aliases to the actions as pointers to the original action
    for (const [key, action] of definedActions.entries())
        if ((typeof action !== `string`) && !!action.aliases)
            action.aliases.forEach(alias => {
                definedActions.set(alias, key);
            });

    // Figure out what we're doing
    for (let idx = 0, total = args.length; idx < total; idx++) {
        let checkArgument = args.shift(),
            action: IAction;

        // For data service actions, a server name/IP can be specified if it's not the localhost
        if (!!checkArgument && (checkArgument.substr(0, 1) == `@`))
            dataServiceHost = checkArgument.substr(1);
        else {
            const { action, argument } = findAction(definedActions, checkArgument);

            if (!!action) {
                // action is not a string

                let addArgument: IActionToTake = { name: argument, additionalArguments: [] };

                // Check for additional arguments
                let argumentCounter = action.additionalArguments;
                while ((args.length > 0) && !!argumentCounter) {
                    argumentCounter--;

                    let nextArgument = args[0];

                    // Confirm it doesn't match another action
                    if (!definedActions[nextArgument])
                        addArgument.additionalArguments.push(args.shift());
                }

                actionsToTake.push(addArgument);
            }
        }
    }

    if (actionsToTake.length == 0)
        actionsToTake.push({ name: `help` });
    else if (actionsToTake.length > 1) {
        // Set the actions to empty
        actionsToTake = [];

        // eslint-disable-next-line no-console
        console.log(`Multiple actions cannot be combined.\n\nSee 'help' for more details.\n`);
    }
    return { actionsToTake, dataServiceHost };
}

export {
    parseArguments as ParseArguments,
};
