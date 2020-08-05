// Node Modules
import { createServer as CreateHttpServer } from "http";

// NPM Modules
import { Info } from "multi-level-logger";

// Application Modules
import { RouteMatch } from "./router";
import { CacheContents } from "../dns/cache";
import { Answer } from "../dns/rfc1035/answer";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";

async function dataServer(configuration: IConfiguration): Promise<void> {
    const server = CreateHttpServer(async (req, res) => {
        const routes: Map<string, () => Promise<any>> = new Map();

        routes.set(`GET:/dns/cache-list`, () => dnsListCache(configuration));
        routes.set(`GET:/dns/cache-list/all`, () => dnsListCache(configuration, true));

        const dataForResponse = await RouteMatch(req, routes);

        res.writeHead(200, { [`Content-Type`]: `application/json` });
        res.write(JSON.stringify(dataForResponse));
        res.end();
    });

    server.on(`listening`, () => {
        Info(`Starting data server`);
        Info(server.address());
    });

    server.listen({ host: configuration.serverIpAddress, port: 45332 });
}

async function dnsListCache(configuration: IConfiguration, includeAll?: boolean) {
    if (configuration.dns.disabled)
        return { disabled: true };

    const fullCache = CacheContents();

    const filteredList: Array<Answer> = [];
    for (const [cacheId, answer] of fullCache.entries()) {
        if (includeAll || !answer.startingTTL)
            filteredList.push(answer);
    }

    return filteredList;
}

export {
    dataServer as DataServer,
};
