// Node/NPM modules
const http = require(`http`);

const MAX_ENTRIES = 100;

function queryHistory(action, allActions, configuration) {
    let urlPath = `/dhcp/history`,
        title = `DHCP Client History`;

    let idIdx = action.additionalArguments.indexOf(`--id`),
        showAll = (action.additionalArguments.indexOf(`--all`) >= 0);

    if ((idIdx < 0) || (action.additionalArguments.length < (idIdx + 2))) {
        // eslint-disable-next-line no-console
        console.log(`\n----- ${title} -----\n`);

        // eslint-disable-next-line no-console
        console.log(`>>> An "--id" parameter, followed by a client id (e.g. MAC) is required\n`);
    } else {
        let clientId = action.additionalArguments[idIdx + 1];
        urlPath += `/${clientId}`;

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

                res.on(`end`, () => {
                    let dhcpData = JSON.parse(data);

                    // eslint-disable-next-line no-console
                    console.log(`\n----- ${title} (${clientId}) -----\n`);

                    let history = dhcpData.history.filter(() => { return true; });
                    // Sort by the date
                    history.forEach(entry => { entry.timestamp = new Date(entry.ts); });
                    // Sort by timestamp
                    history.sort((a, b) => { return a.timestamp.getTime() > b.timestamp.getTime() ? 1 : -1; });

                    // Unless we're showing everything, only show the first MAX_ENTRIES lines
                    if (!showAll) {
                        history.reverse();
                        history = history.filter((entry, idx) => { return idx < MAX_ENTRIES; });
                        history.reverse();
                    }

                    let lastTimestamp = null;
                    history.forEach(entry => {
                        let display = ``;
                        // Display the timestamp
                        let ts = (new Date(entry.ts)).toLocaleString();
                        if (ts == lastTimestamp)
                            ts = `-------`.padStart(ts.length, ` `);
                        lastTimestamp = ts;
                        display += `${ts} - `;

                        if (!!entry.dhcpMessage)
                            display += entry.dhcpMessage.type;
                        else if (!!entry.address) {
                            display += `Assigned to ${entry.address}`;
                            if (!!entry.hostnameFromDns)
                                display += `, and "${entry.hostnameFromDns}" in DNS`;
                        } else
                            display += JSON.stringify(entry);

                        // eslint-disable-next-line no-console
                        console.log(display);
                    });

                    if (showAll || (history.length == dhcpData.history.length))
                        console.log(`\n   ...${history.length} entr${dhcpData.length == 1 ? `y` : `ies`} found\n`);
                    else
                        console.log(`\n   ...${history.length} entr${dhcpData.length == 1 ? `y` : `ies`} displayed out of ${dhcpData.history.length} total.  Use '--all' to display.\n`);
                });
            }
        );
    }
}

module.exports.DHCPHistory = queryHistory;
