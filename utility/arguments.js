function parseArguments(definedActions) {
    // Copy the arguments to a new array
    let args = process.argv.filter(() => { return true; }),
        actionsToTake = [];

    // Add any aliases to the actions as pointers to the original action
    for (let key in definedActions)
        if (!!definedActions[key].aliases)
            definedActions[key].aliases.forEach(alias => {
                definedActions[alias] = key;
            });

    // Figure out what we're doing
    for (let idx = 0, total = args.length; idx < total; idx++) {
        let argument = args.shift(),
            action;

        do {
            action = definedActions[argument];

            if (!!action && (typeof action == `string`)) {
                argument = action;
                action = null;
            } else if (!action)
                argument = null;
        } while (!!action && (typeof action == `string`));

        if (!!argument) {
            let addArgument = { name: argument, additionalArguments: [] };

            // Check for additional arguments
            let argumentCounter = definedActions[argument].additionalArguments;
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

    if (actionsToTake.length == 0)
        actionsToTake.push({ name: `help` });
    else if (actionsToTake.length > 1) {
        // Set the actions to empty
        actionsToTake = [];

        // eslint-disable-next-line no-console
        console.log(`Multiple actions cannot be combined.\n\nSee 'help' for more details.\n`);
    }
    return actionsToTake;
}

module.exports.ParseArguments = parseArguments;
