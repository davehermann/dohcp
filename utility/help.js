// Application modules
const { TABS } = require(`./shared`);

function printHelp(actionName, definedActions) {
    let helpText = ``,
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
            idSpaces = (Math.ceil(maxIdLength / TABS.length) + 1) * TABS.length;

        helpText += actionList.map(action => { return `${TABS}${action.trigger.padEnd(idSpaces, ` `)}${action.description}\n`; }).join(``);
    }

    // eslint-disable-next-line no-console
    console.log(`${helpText}\n`);

    return Promise.resolve();
}

module.exports.PrintHelp = printHelp;
