// Node Modules
import * as dgram from "dgram";

// NPM Modules
import { Dev, Trace, Debug, Info, Err } from "multi-level-logger";

// Application Modules
import { LoadPreconfiguredRecords, CacheContents } from "./cache";
import { ResolveDNSQuery } from "./resolver";
import { DNSMessage } from "./rfc1035/dnsMessage";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { Answer } from "./rfc1035/answer";

const DNS_SERVER_PORT = 53;

class DNSServer {
    constructor(private readonly configuration: IConfiguration) {}

    /** DNS is enabled in configuration */
    public get isEnabled(): boolean {
        return !!this.configuration.dns && !this.configuration.dns.disabled;
    }

    private async listenForDnsRequests(remainingAddresses?: Array<string>): Promise<void> {
        if (remainingAddresses === undefined)
            return this.listenForDnsRequests(this.listOfAddressesToListenOn());
        else if (remainingAddresses.length > 0) {
            Dev({ remainingAddresses }, { logName: `dns` });

            await this.newDnsSocket(remainingAddresses.shift());

            return this.listenForDnsRequests(remainingAddresses);
        }
    }

    private listOfAddressesToListenOn(): Array<string> {
        // Step through servers configuration
        // Any entry that is "primaryIP", or an IP on the configured interface, will listen for DNS
        const remainingAddresses = this.configuration.dns.servers
            .filter(ip => {
                return (ip == `primaryIP`) || (this.configuration.ipv4Addresses.map(addr => { return addr.address; }).indexOf(ip) >= 0);
            })
            .map(ip => {
                return (ip == `primaryIP`) ? this.configuration.serverIpAddress : ip;
            });

        // Also respond on localhost if "primaryIP" is configured
        if (this.configuration.dns.servers.filter(ip => { return ip == `primaryIP`; }).length > 0)
            remainingAddresses.push(`127.0.0.1`);

        return remainingAddresses;
    }

    private newDnsSocket(ipAddress: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const server = dgram.createSocket({ type: `udp4` });
            let bindingSucceeded = false;

            server.on(`listening`, () => {
                const address = server.address();
                Info({ [`Binding address`]: address }, { logName: `dns` });

                bindingSucceeded = true;
                resolve();
            });

            // Every time a message is received
            server.on(`message`, (msg, rinfo) => {
                const timestamp = new Date(),
                    newDenotation = ` New Query `,
                    denotationMask = 45;

                // For Debug or lower levels, add a separator line
                Debug(newDenotation.padStart(newDenotation.length + denotationMask, `-`).padEnd(newDenotation.length + (denotationMask * 2), `-`), { logName: `dns` });

                Trace({
                    [`Remote address information`]: rinfo,
                    [`Hexadecimal query`]: msg.toString(`hex`),
                }, { logName: `dns` });

                const dnsQuery = new DNSMessage();
                dnsQuery.FromDNS(msg);
                Trace({ dnsQuery }, { logName: `dns` });

                ResolveDNSQuery(dnsQuery, this.configuration, rinfo)
                    .then(dnsAnswer => {
                        Info(`DNS Query (${rinfo.address}) - ${dnsQuery.queryId} - ${(new Date()).getTime() - timestamp.getTime()}ms - ${dnsQuery.questions.map(q => { return q.label; }).join(`, `)}: ${dnsAnswer.answers.map(a => { return a.summary; }).join(`, `)}`, { logName: `dns` });
                        // Send response
                        server.send(dnsAnswer.dnsMessage, rinfo.port, rinfo.address);
                    })
                    .catch(err => {
                        Err(err, { logName: `dns` });
                    });
            });

            server.on(`error`, (err) => {
                Err(`An error has occurred`, { logName: `dns` });
                Err(err, { logName: `dns` });

                // If the error was on binding, reject the Promise
                if (!bindingSucceeded)
                    reject(err);
            });

            // Bind to the IP
            server.bind({ port: DNS_SERVER_PORT, address: ipAddress });
        });
    }

    public CurrentCache(): Map<string, Answer> {
        return CacheContents();
    }

    /** Start the DNS service */
    public async Start(): Promise<void> {
        if (this.isEnabled) {
            Info(`Starting DNS Server`, { logName: `dns` });

            LoadPreconfiguredRecords(this.configuration);

            await this.listenForDnsRequests();
        }
    }
}

export {
    DNSServer,
};
