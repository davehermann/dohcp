function printHelp(actionName, definedActions) {
    let helpText = ``,
        tabs = `    `,
        actionList = [];

    helpText += `\nUsage: dohcp [options] action [action-options]\n\n`;
    helpText += `Options:\n\n`;

    for (let actionName in definedActions) {
        let action = definedActions[actionName],
            aliases = [actionName];

        if (typeof action !== `string`) {
            if (!!action.aliases)
                aliases = aliases.concat(action.aliases);

            actionList.push({ trigger: aliases.join(`, `), description: action.description });
        }
    }

    if (actionList.length > 0) {
        helpText += `Actions:\n\n`;

        let maxIdLength = Math.max(...actionList.map(action => { return action.trigger.length; })),
            idSpaces = (Math.ceil(maxIdLength / tabs.length) + 1) * tabs.length;

        helpText += actionList.map(action => { return `${tabs}${action.trigger.padEnd(idSpaces, ` `)}${action.description}\n`; }).join(``);
    }

    // eslint-disable-next-line no-console
    console.log(`${helpText}\n`);
}

module.exports.PrintHelp = printHelp;
