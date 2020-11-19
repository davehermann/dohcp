// Node Modules
import { get as HttpGet } from "http";

// NPM Modules
import { Log } from "multi-level-logger";

// Application Modules
import { IAction, IActionToTake } from "../../interfaces/configuration/cliArguments";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { Answer } from "../../server/dns/rfc1035/answer";

function queryCache(action: IActionToTake, allActions: Map<string, IAction>, configuration: IConfiguration): Promise<void> {
    const showForward = action.additionalArguments.indexOf(`--all`) >= 0,
        sortByAddress = !showForward && (action.additionalArguments.indexOf(`--by-address`) >= 0);
    const urlPath = `/dns/cache-list${showForward ? `/all` : ``}`;

    return new Promise(resolve => {
        HttpGet(
            {
                host: configuration.dataServiceHost,
                port: 45332,
                path: urlPath,
            },
            res => {
                let data = ``;
                res.on(`data`, (chunk) => {
                    data += chunk;
                });

                res.on(`end`, () => {
                    const cacheList = JSON.parse(data),
                        currentTime = (new Date()).getTime(),
                        display = [];

                    if ((typeof cacheList == `object`) && cacheList.disabled)
                        // eslint-disable-next-line no-console
                        console.log(`\nThe DNS service is not enabled\n`);
                    else {
                        const dnsAnswers = (cacheList as Array<Answer>);
                        let longestKey = ``;
                        dnsAnswers.forEach(answer => {
                            if (answer.label.length > longestKey.length)
                                longestKey = answer.label;
                        });

                        // Sort the answers
                        dnsAnswers.sort((a, b) => ((sortByAddress ? a.rdata[0] < b.rdata[0] : a.label < b.label) ? -1 : 1));

                        dnsAnswers.forEach(answer => {
                            const recordType = `[${answer.typeId}]`,
                                displayTTL = !!answer.startingTTL ? ` (exp: ${Math.round((answer.ttlExpiration - currentTime) / 1000)} sec)` : ``;

                            const report = `${(answer.label + `  `).padEnd(longestKey.length + 2, `-`)}-> ${recordType.padStart(8, ` `)}  ${answer.rdata}${displayTTL}`;

                            display.push(report);
                        });

                        const displayData =
                            `---- Entries currently in local DNS ----\n`
                            + `     - ${display.length} found\n`
                            + `${display.join(`\n`)}\n`;

                        Log(displayData, { configuration: { includeCodeLocation: false, includeTimestamp: false, useColors: false } });
                    }

                    resolve();
                });
            }
        );
    });
}

export {
    queryCache as QueryCache,
};
