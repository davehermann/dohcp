// Node Modules
import { createServer as CreateHttpServer, Server } from "http";

// NPM Modules
import { Info, Log } from "multi-level-logger";

// Application Modules
import { RouteMatch } from "./router";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { AddressInfo } from "net";
import { DNSServer } from "../dns/dns-main";
import { Answer } from "../dns/rfc1035/answer";
import { DHCPServer } from "../dhcp/dhcp-main";
import { AllocatedAddress } from "../dhcp/allocation/AllocatedAddress";
import { ClientHistory } from "../history/history";

class DataServer {
    constructor(private readonly configuration: IConfiguration, private readonly dnsServer: DNSServer, private readonly dhcpServer: DHCPServer, private readonly history: ClientHistory) {
        this.defineRoutes();
    }

    private routes: Map<string, (params?: any) => Promise<unknown>> = new Map();
    private server: Server;

    private defineRoutes(): void {
        this.routes.set(`GET:/dhcp/leases`, () => this.dhcpListLeases());
        this.routes.set(`GET:/dns/cache-list`, () => this.dnsListCache());
        this.routes.set(`GET:/dns/cache-list/all`, () => this.dnsListCache(true));
        this.routes.set(`GET:/history/dns/:ipAddress`, (params) => this.historyDns(params.ipAddress));
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

        const fullCache = this.dnsServer.CurrentCache();

        const filteredList: Array<Answer> = [];
        for (const [cacheId, cachedAnswers] of fullCache.entries()) {
            cachedAnswers.forEach(answerInCache => {
                if (includeAll || !answerInCache.answer.startingTTL)
                    filteredList.push(answerInCache.answer);
            });
        }

        return filteredList;
    }

    //#endregion DNS Data

    //#region  History

    private async historyDns(ipAddress: string) {
        return this.history.GetDnsByIp(ipAddress);
    }

    //#endregion History

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
