// Node Modules
import { get as HttpGet } from "http";

// Application Modules
import { IAction, IActionToTake } from "../../interfaces/configuration/cliArguments";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";

async function stats(action: IActionToTake, allActions: Map<string, IAction>, configuration: IConfiguration): Promise<void> {
    const requestPath = `/system/memory-usage`;

    const memoryUsed = await new Promise(resolve => {
        HttpGet(
            {
                host: configuration.dataServiceHost,
                port: configuration.dataServicePort,
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

    console.log(memoryUsed);
}

export {
    stats as SystemStats,
};
