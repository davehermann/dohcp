// Application modules
const { TABS } = require(`./shared`);

function printHelp(actionName, definedActions) {
    let helpText = ``,
        actionList = [];

    helpText += `\nUsage: dohcp [@host] action [action-options]\n\n`;
    helpText += `Options:\n`;
    helpText += `${TABS}'@' + hostname/IP Address${TABS}${TABS}When using remotely, specify the hostname (in DNS) or the IP of the remote DoHCP server\n`;

    for (let actionName in definedActions) {
        let action = definedActions[actionName],
            aliases = [actionName];

        if (typeof action !== `string`) {
            if (!!action.aliases)
                aliases = aliases.concat(action.aliases);

            let actionDescription = { trigger: aliases.join(`, `), description: action.description };

            if (!!action.additionalArguments) {
                actionDescription.trigger += ` [options]`;
                actionDescription.options = action.argumentsDescription;
            }

            actionList.push(actionDescription);
        }
    }

    if (actionList.length > 0) {
        helpText += `\nActions:\n\n`;

        let maxIdLength = Math.max(...actionList.map(action => { return action.trigger.length; })),
            idSpaces = (Math.ceil(maxIdLength / TABS.length) + 1) * TABS.length;

        helpText += actionList.map(action => {
            let actionDescription = `${TABS}${action.trigger.padEnd(idSpaces, ` `)}${action.description}\n`;
            if (action.options)
                action.options.forEach(opt => {
                    actionDescription += `${TABS}${TABS}${opt.arg}${TABS}${opt.detail}\n`;
                });

            return actionDescription;
        }).join(``);
    }

    // eslint-disable-next-line no-console
    console.log(`${helpText}\n`);

    return Promise.resolve();
}

module.exports.PrintHelp = printHelp;
