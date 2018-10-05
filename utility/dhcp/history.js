// Node/NPM modules
const http = require(`http`),
    readline = require(`readline`);

// Application modules
const { TABS } = require(`../shared`);

const MAX_ENTRIES = 100;

function queryHistory(action, allActions, configuration) {
    let completeRequest = Promise.resolve();

    let urlPath = `/dhcp/history`,
        title = `DHCP Client History`;

    let idIdx = action.additionalArguments.indexOf(`--id`),
        showAll = (action.additionalArguments.indexOf(`--all`) >= 0),
        idMax = action.additionalArguments.indexOf(`--max`);

    if ((idIdx < 0) || (action.additionalArguments.length < (idIdx + 2))) {
        // eslint-disable-next-line no-console
        console.log(`\n----- ${title} -----\n`);

        // eslint-disable-next-line no-console
        console.log(`>>> An "--id" parameter, followed by a client id (e.g. MAC) is required\n`);
    } else {
        let clientId = action.additionalArguments[idIdx + 1];
        urlPath += `/${clientId}`;

        completeRequest = new Promise(resolve => {
            http.get(
                {
                    host: configuration.dataServiceHost,
                    port: 45332,
                    path: urlPath,
                },
                (res) => {
                    let data = ``;
                    res.on(`data`, (chunk) => {
                        data += chunk;
                    });

                    res.on(`end`, () => { resolve(data); });
                }
            );
        })
            .then(data => {
                let dhcpData = JSON.parse(data);

                // eslint-disable-next-line no-console
                console.log(`\n----- ${title} (${clientId}) -----\n`);

                let history = dhcpData.history.filter(() => { return true; });
                // Set timestamps to JS dates
                history.forEach(entry => { entry.timestamp = new Date(entry.ts); });
                // Sort by timestamp
                history.sort((a, b) => { return a.timestamp.getTime() > b.timestamp.getTime() ? 1 : -1; });

                // Limit the entries
                let maxEntries = MAX_ENTRIES;
                if ((idMax >= 0)  && (action.additionalArguments.length >= idMax + 2)) {
                    let maxOption = parseInt(action.additionalArguments[idMax + 1]);
                    if (!!maxOption)
                        maxEntries = maxOption;
                }

                // Unless we're showing everything, only show the first MAX_ENTRIES lines
                if (!showAll) {
                    history.reverse();
                    history = history.filter((entry, idx) => { return idx < maxEntries; });
                    history.reverse();
                }

                return displayHistoryEntries(history, showAll, dhcpData);
            });
    }

    return completeRequest;
}

function displayHistoryEntries(history, showAll, dhcpData) {
    let lastTimestamp = null,
        detailId = 0;

    history.forEach(entry => {
        let display = ``;
        // Display the timestamp
        let ts = (new Date(entry.ts)).toLocaleString();
        if (ts == lastTimestamp)
            ts = `-------`.padStart(ts.length, ` `);
        lastTimestamp = ts;
        display += `${ts} - `;

        if (!!entry.dhcpRequest) {
            display += `(${++detailId}) - `;

            display += entry.dhcpRequest.options.dhcpMessageType;
            if (!!entry.dhcpResponse)
                display += `, responded with ${entry.dhcpResponse.dhcpMessage.options.dhcpMessageType}`;
        } else if (!!entry.address) {
            display += `Assigned to ${entry.address}`;
            if (!!entry.hostnameFromDns)
                display += `, and "${entry.hostnameFromDns}" in DNS`;
        } else
            display += JSON.stringify(entry);

        // eslint-disable-next-line no-console
        console.log(display);
    });

    if (showAll || (history.length == dhcpData.history.length))
        // eslint-disable-next-line no-console
        console.log(`\n   ...${history.length} entr${dhcpData.length == 1 ? `y` : `ies`} found\n`);
    else
        // eslint-disable-next-line no-console
        console.log(`\n   ...${history.length} entr${dhcpData.length == 1 ? `y` : `ies`} displayed out of ${dhcpData.history.length} total.  Use '--all' to display.\n`);

    // Display details for DHCP message entries
    if (detailId > 0)
        return displayMessageDetails(history, showAll, dhcpData);
}

function displayMessageDetails(history, showAll, dhcpData) {
    return new Promise(resolve => {
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        // eslint-disable-next-line no-console
        console.log(`For DHCP message details, use the (number in parentheses)`);
        // eslint-disable-next-line no-console
        console.log(`'L' to re-list`);
        // eslint-disable-next-line no-console
        console.log(`'Q' to quit`);

        rl.question(`\n: `, (answer) => {
            rl.close();

            resolve(answer.trim());
        });
    })
        .then(answer => {
            let isNumber = (answer.search(/^\d+$/) >= 0),
                isList = (answer.search(/^L$/i) >= 0),
                isQuit = (answer.search(/^Q$/i) >= 0);

            if (isQuit)
                return Promise.resolve();
            else if (isNumber) {
                let detailId = 0;
                for (let idxHistory = 0; idxHistory < history.length; idxHistory++) {
                    let entry = history[idxHistory];

                    if (!!entry.dhcpRequest) {
                        if (++detailId == +answer) {
                            // eslint-disable-next-line no-console
                            console.log(`\n${TABS}${(new Date(entry.ts)).toLocaleString()}`);
                            // eslint-disable-next-line no-console
                            console.log(`\n${TABS}--- ${entry.dhcpRequest.options.dhcpMessageType} ---`);
                            // eslint-disable-next-line no-console
                            console.log(JSON.stringify(entry.dhcpRequest));
                            // eslint-disable-next-line no-console
                            console.log(`\n${TABS}--- ${entry.dhcpResponse.dhcpMessage.options.dhcpMessageType} ---`);
                            // eslint-disable-next-line no-console
                            console.log(JSON.stringify(entry.dhcpResponse));
                            // eslint-disable-next-line no-console
                            console.log();
                            break;
                        }
                    }
                }

                return displayMessageDetails(history, showAll, dhcpData);
            } else {
                if (!isList)
                    // eslint-disable-next-line no-console
                    console.log(`${answer}' is not recognized`);
                return displayHistoryEntries(history, showAll, dhcpData);
            }
        });
}

module.exports.DHCPHistory = queryHistory;
