// Node Modules
import { createServer as CreateHttpServer, Server } from "http";
import { promises as fs } from "fs";
import * as path from "path";

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

const CLEAR_MAC_VENDOR_LIST_TIMEOUT = 300000;

interface IMacVendor {
    id: string,
    registry: string;
    name: string;
    address: string;
}

class DataServer {
    constructor(private readonly configuration: IConfiguration, private readonly dnsServer: DNSServer, private readonly dhcpServer: DHCPServer, private readonly history: ClientHistory) {
        this.defineRoutes();
    }

    private routes: Map<string, (params?: any) => Promise<unknown>> = new Map();
    private server: Server;

    private macVendors: Map<string, Array<IMacVendor>> = new Map();
    private clearMacVendors: NodeJS.Timeout = null;

    private defineRoutes(): void {
        this.routes.set(`GET:/dhcp/leases`, () => this.dhcpListLeases());
        this.routes.set(`GET:/dhcp/leases/all`, () => this.dhcpListLeases(true));
        this.routes.set(`GET:/dns/cache-list`, () => this.dnsListCache());
        this.routes.set(`GET:/dns/cache-list/all`, () => this.dnsListCache(true));
        this.routes.set(`GET:/history/dhcp/for-client/:clientId`, (params) => this.historyDhcpForClient(params.clientId));
        this.routes.set(`GET:/history/dhcp/get-clients`, () => this.historyDhcpClients());
        this.routes.set(`GET:/history/dns/for-ip/:ipAddress`, (params) => this.historyDnsForIp(params.ipAddress));
        this.routes.set(`GET:/history/dns/recent-ips`, () => this.historyDnsIps());
        this.routes.set(`GET:/system/stats`, () => this.systemStats());
    }

    //#region DHCP Data

    private async dhcpListLeases(includePreRestart = false) {
        if (!this.dhcpServer.isEnabled)
            return { disabled: true };

        const leases = this.dhcpServer.GetAllocations(),
            leaseData: Array<AllocatedAddress> = [],
            currentMoment = (new Date()).getTime();

        for (const [ipAddress, allocatedAddress] of leases.byIp) {
            // By default, only leases that have not expired AND have been given out since the last service restart are included
            const isAssignedInSession = !!allocatedAddress && allocatedAddress.allocatedInSession && (allocatedAddress.leaseExpirationTimestamp.getTime() > currentMoment),
                isAssignedPreviously = !!allocatedAddress && (allocatedAddress.leaseStart + (this.configuration.dhcp.leases.pool.leaseSeconds * 1000) > currentMoment);

            if (isAssignedInSession || (includePreRestart && isAssignedPreviously))
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

    private async historyDhcpClients() {
        return this.history.GetClientsInDHCPHistory();
    }

    private async historyDhcpForClient(clientId: string) {
        // Ensure the vendors are loaded
        await this.loadMacVendors();

        const history = {
            events: this.history.GetDhcpHistoryForClient(clientId),
            vendors: this.macVendors.get(clientId.replace(/:/g, ``).substr(0, 6).toLowerCase()),
        };

        return history;
    }

    private async historyDnsIps() {
        return this.history.GetIpsInDnsHistory();
    }

    private async historyDnsForIp(ipAddress: string) {
        return this.history.GetDnsByIp(ipAddress);
    }

    //#endregion History

    private async systemStats() {
        const stats = {
            startTime: this.configuration.serviceStart,
            memory: process.memoryUsage(),
        };

        return stats;
    }

    //#region  MAC Vendors

    /** Reset MAC vendor clearing timeout */
    private automaticallyClearMacVendors() {
        if (!!this.clearMacVendors)
            clearTimeout(this.clearMacVendors);

        this.clearMacVendors = setTimeout(() => {
            this.macVendors = new Map();
        }, CLEAR_MAC_VENDOR_LIST_TIMEOUT);
    }

    /**
     * Load list of vendors from MAC database
     *
     * @remarks
     * Database is CSV download of the MA-L (MAC Address Block Large) list available at
     * https://regauth.standards.ieee.org/standards-ra-web/pub/view.html#registries
     */
    private async loadMacVendors() {
        // Always reset the cache clear timer
        this.automaticallyClearMacVendors();

        // If no vendors are listed, load the vendor list
        if (this.macVendors.size == 0) {
            const csvData = await fs.readFile(path.join(__dirname, `mac-vendor`, `MA-L.csv`), { encoding: `utf8` });
            const csvLines = csvData.split(`\n`);
            csvLines.forEach(vendorLine => {
                // Split at all commas
                const segments = vendorLine.split(`,`);
                // Recombine any token that starts with a double-quote with those following until the next double-quote
                const vendorValues: Array<string> = [];
                let quoteOpen = false;
                segments.forEach(segment => {
                    // Remove two double-quotes together
                    let idxTwoDoubles = segment.indexOf(`""`);
                    while (idxTwoDoubles >= 0) {
                        let newSegment = segment.substr(0, idxTwoDoubles);
                        if (segment.length > (idxTwoDoubles + 2))
                            newSegment += segment.substr(idxTwoDoubles + 2);
                        segment = newSegment;
                        idxTwoDoubles = segment.indexOf(`""`);
                    }

                    // If the start and end of the segment are both double-quotes, remove them
                    if (segment.search(/^".*"$/) == 0)
                        segment = segment.substr(1, segment.length - 2);

                    const idxDoubleQuote = segment.indexOf(`"`);

                    if ((idxDoubleQuote < 0) && !quoteOpen)
                        vendorValues.push(segment);
                    else if (idxDoubleQuote == 0) {
                        quoteOpen = true;
                        vendorValues.push(segment.substr(1));
                    } else if ((idxDoubleQuote < 0) && quoteOpen)
                        vendorValues[vendorValues.length - 1] += `,${segment}`;
                    else {
                        vendorValues[vendorValues.length - 1] += `,${segment.substr(0, idxDoubleQuote)}`;
                        quoteOpen = false;
                    }
                });

                let idxEmpty = -1;
                do {
                    idxEmpty = vendorValues.findIndex(val => (val.length == 0));
                    if (idxEmpty >= 0) {
                        vendorValues.splice(idxEmpty, 1);
                    }
                } while (idxEmpty >= 0);

                if (vendorValues.length > 0) {
                    if (vendorValues.length !== 4)
                        throw `Loading MAC vendor list - unexpected data: ${JSON.stringify(vendorValues)}`;

                    const vendor: IMacVendor = {
                        id: vendorValues[1],
                        registry: vendorValues[0],
                        name: vendorValues[2],
                        address: vendorValues[3],
                    };

                    if (!this.macVendors.has(vendorValues[1]))
                        this.macVendors.set(vendorValues[1].toLowerCase(), []);

                    this.macVendors.get(vendorValues[1].toLowerCase()).push(vendor);
                }
            });
        }
    }

    //#endregion MAC Vendors

    public async Start(): Promise<void> {
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

            this.server.listen({ host: this.configuration.dataServiceHost, port: this.configuration.dataServicePort });
        });
    }
}

export {
    DataServer,
};
