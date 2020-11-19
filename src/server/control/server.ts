// Node Modules
import { createServer as CreateHttpServer, Server } from "http";

// NPM Modules
import { Info } from "multi-level-logger";

// Application Modules
import { RouteMatch } from "./router";
import { CacheContents } from "../dns/cache";
import { Answer } from "../dns/rfc1035/answer";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { AddressInfo } from "net";

class DataServer {
    constructor(private readonly configuration: IConfiguration) {
        this.defineRoutes();
    }

    private routes: Map<string, () => Promise<unknown>> = new Map();
    private server: Server;

    private defineRoutes(): void {
        this.routes.set(`GET:/dns/cache-list`, () => this.dnsListCache());
        this.routes.set(`GET:/dns/cache-list/all`, () => this.dnsListCache(true));
    }

    //#region DNS Data

    private async dnsListCache(includeAll = false) {
        if (this.configuration.dns.disabled)
            return { disabled: true };

        const fullCache = CacheContents();

        const filteredList: Array<Answer> = [];
        for (const [cacheId, answer] of fullCache.entries()) {
            if (includeAll || !answer.startingTTL)
                filteredList.push(answer);
        }

        return filteredList;
    }

    //#endregion DNS Data

    public Initialize(): Promise<void> {
        this.server = CreateHttpServer(async (req, res) => {
            const dataForResponse = await RouteMatch(req, this.routes);

            res.writeHead(200, { [`Content-Type`]: `application/json` });
            res.write(JSON.stringify(dataForResponse));
            res.end();
        });

        return new Promise((resolve, reject) => {
            this.server.on(`listening`, () => {
                const address: AddressInfo = this.server.address() as AddressInfo;
                Info({ [`Data Server listening`]: address });
                resolve();
            });

            this.server.listen({ host: this.configuration.serverIpAddress, port: 45332 });
        });
    }
}

export {
    DataServer,
};
