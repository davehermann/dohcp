// Node Modules
import { get as HttpGet } from "http";
import { IActionToTake, IAction } from "../../interfaces/configuration/cliArguments";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { DNSEvent, IDNSEventStream } from "../../server/history/history";
import { Log } from "multi-level-logger";

async function clientHistory(action: IActionToTake, allActions: Map<string, IAction>, configuration: IConfiguration): Promise<void> {
    // IP address is required
    const idxIpFlag = action.additionalArguments.indexOf(`--ip`),
        orderByDomain = action.additionalArguments.indexOf(`--by-domain`) >= 0;

    // Ensure an IP address value has been entered, but don't validate as an IP
    if ((idxIpFlag < 0) || (action.additionalArguments.length < idxIpFlag + 2))
        throw `IP address required via the "--ip" flag\n`;

    const ipAddress = action.additionalArguments[idxIpFlag + 1];
    const requestPath = `/history/dns/${ipAddress}`;

    const rawData: Array<IDNSEventStream> = await new Promise(resolve => {
        HttpGet(
            {
                host: configuration.dataServiceHost,
                port: 45332,
                path: requestPath,
            },
            res => {
                let data = ``;
                res.on(`data`, (chunk) => {
                    data += chunk;
                });

                res.on(`end`, () => {
                    resolve(JSON.parse(data));
                });
            }
        );
    });

    const historyData: Array<DNSEvent> = rawData.map(record => {
        return DNSEvent.fromDataStream(record);
    });

    if (orderByDomain)
        historyData.sort((a, b) => (a.question < b.question ? -1 : 1));

    let report = `\n---------- DNS History for ${ipAddress} ----------\n`;

    historyData.forEach(request => {
        report += `\n--- ${request.question} (${request.requests.length}) ---`;
        request.requests.forEach(timestamp => {
            report += `\n     - ${timestamp.toLocaleString()}`;
        });
    });

    Log(report, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
}

export {
    clientHistory as ClientHistory,
};
