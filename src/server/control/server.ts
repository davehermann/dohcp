// Node Modules
import { createServer as CreateHttpServer, Server } from "http";

// NPM Modules
import { Info, Log } from "multi-level-logger";

// Application Modules
import { RouteMatch } from "./router";
import { CacheContents } from "../dns/cache";
import { Answer } from "../dns/rfc1035/answer";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { AddressInfo } from "net";
import { DHCPServer } from "../dhcp/dhcp-main";
import { AllocatedAddress } from "../dhcp/allocation/AllocatedAddress";

class DataServer {
    constructor(private readonly configuration: IConfiguration, private readonly dhcpServer: DHCPServer) {
        this.defineRoutes();
    }

    private routes: Map<string, () => Promise<unknown>> = new Map();
    private server: Server;

    private defineRoutes(): void {
        this.routes.set(`GET:/dhcp/leases`, () => this.dhcpListLeases());
        this.routes.set(`GET:/dns/cache-list`, () => this.dnsListCache());
        this.routes.set(`GET:/dns/cache-list/all`, () => this.dnsListCache(true));
    }

    //#region DHCP Data

    private async dhcpListLeases() {
        if (!this.dhcpServer.isEnabled)
            return { disabled: true };

        const leases = this.dhcpServer.GetAllocations(),
            leaseData: Array<AllocatedAddress> = [],
            currentMoment = (new Date()).getTime();

        for (const [ipAddress, allocatedAddress] of leases.byIp) {
            // By default, only leases that have not expired AND have been given out since the last service restart are included
            if (!!allocatedAddress && allocatedAddress.allocatedInSession && (allocatedAddress.leaseExpirationTimestamp.getTime() > currentMoment))
                leaseData.push(allocatedAddress);
        }

        return { leaseData };
    }

    //#endregion DHCP Data

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

    public Start(): Promise<void> {
        Log(`Starting data Server`);

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
