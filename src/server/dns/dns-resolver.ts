// Node Modules
import * as dgram from "dgram";
import { request as WebRequest, RequestOptions as HttpRequestOptions } from "https";

// NPM Modules
import { Warn, Debug, Trace, Dev, Err } from "multi-level-logger";

// Application Modules
import { Cache, CachedAnswer } from "./dns-cache";
import { DNSMessage } from "./rfc1035/dnsMessage";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { eDnsClass, eDnsType } from "../../interfaces/configuration/dns";

class Resolver {
    constructor(private readonly configuration: IConfiguration, private readonly cache: Cache) {}

    //#region Answer Processing Determination

    /**
     * Log queries with more than one question to warn, and don't cache or rewrite the answers
     * @param dnsQuery - Query to check
     * @returns Skip additional processing of the answer
     */
    private multiQuestionQuery(dnsQuery: DNSMessage): boolean {
        //
        if (dnsQuery.qdcount !== 1) {
            Warn({ [`MULTI-QUESTION QUERY (unexpected)`]: dnsQuery }, { logName: `dns` });
            return true;
        }

        return false;
    }

    /**
     * Log queries for not internet class to warn, and don't rewrite the answers
     * @param dnsQuery - Query to check
     * @returns Skip additional processing of the answer
     */
    private nonInternetClassQuery(dnsQuery: DNSMessage): boolean {
        if (dnsQuery.questions.filter(q => { return q.classId !== eDnsClass.IN; }).length > 0) {
            Warn({ [`NOT 'IN' CLASS QUERY (unexpected)`]: dnsQuery }, { logName: `dns` });
            return true;
        }

        return false;
    }

    //#endregion Answer Processing Determination

    //#region Cache Interaction

    /**
     * Try to answer a DNS query from cache
     * @param dnsQuery - Query to check
     */
    private checkCacheForAnswer(dnsQuery: DNSMessage): DNSMessage {
        let answerMessage: DNSMessage = null;

        // Check cache first, but only for single-question queries
        if (dnsQuery.qdcount === 1) {
            const label = dnsQuery.questions[0].label,
                cacheId = Cache.GenerateCacheId(dnsQuery.questions[0]),
                cacheHit = this.cache.FindInCache(cacheId);

            Debug({ label, cacheId, cacheHit }, { logName: `dns` });

            if (!!cacheHit)
                answerMessage = this.respondFromCache(dnsQuery, cacheHit);
        }

        return answerMessage;
    }

    /**
     * Use a cached DNS answer as the answer to a new query
     * @param dnsQuery - Query to check
     * @param cachedAnswer - Answer from the stored cache
     */
    private respondFromCache(dnsQuery: DNSMessage, cachedAnswers: Array<CachedAnswer>) {
        Trace(`Found in cache - responding from cache`, { logName: `dns` });
        Dev({ dnsQuery, cachedAnswers }, { logName: `dns` });

        // Create a new message
        const dnsAnswer = new DNSMessage();

        // Add the matching answers
        dnsAnswer.AddAnswers(cachedAnswers.map(answer => answer.answer));

        return dnsAnswer;
    }

    //#endregion Cache Interaction

    /** Check configuration for the resolver to use */
    private getPrimaryForwardResolver() {
        return this.configuration.dns.upstream.resolvers.find(resolver => (resolver.name == this.configuration.dns.upstream.primary));
    }

    //#region Look Up In DNS

    /**
     * Query a DNS-over-HTTPS service, or a forward DNS server, for the answer
     * @param dnsQuery - Incoming DNS request
     * @param configuration - Server configuration
     * @param useDNSOverHttps - Pass a non-cached request through the DNS-over-HTTPS resolver instead of using standard DNS protocol
     */
    private async answerViaLookup(dnsQuery: DNSMessage, useDNSOverHttps: boolean): Promise<DNSMessage> {
        Debug(`Forwarding to public resolver (via ${useDNSOverHttps ? `DNS-over-HTTPS` : `DNS`})`, { logName: `dns` });

        let responseFromForwardDNS: Uint8Array;
        if (useDNSOverHttps)
            responseFromForwardDNS = await this.dnsOverHttpsLookup(dnsQuery);
        else
            responseFromForwardDNS = await this.dnsLookup(dnsQuery);

        Debug({ [`Complete Response`]: responseFromForwardDNS.toString() }, { logName: `dns` });

        const answerMessage: DNSMessage = new DNSMessage();
        answerMessage.FromDNS(responseFromForwardDNS);
        Debug({ answerMessage }, { logName: `dns` });

        // Do not cache Authoritative responses
        if (answerMessage.nscount == 0)
            this.cache.AddFromForwardDns(answerMessage);

        return answerMessage;
    }

    private async dnsLookup(dnsQuery: DNSMessage): Promise<Uint8Array> {
        const resolver = this.getPrimaryForwardResolver();

        Trace(`Resolving query in forward DNS`, { logName: `dns` });

        // Resolve the hostname (may be in cache, or perform a DNS lookup)
        return new Promise((resolve, reject) => {
            const client = dgram.createSocket({ type: `udp4` });

            client.on(`listening`, () => {
                Trace(`DNS query via UDP listening on ${JSON.stringify(client.address())}`, { logName: `dns` });
                Dev({ dnsQuery }, { logName: `dns` });

                client.send(dnsQuery.typedMessage, 53, resolver.servers[0]);
            });

            client.on(`message`, (msg, rinfo) => {
                // msg is a Buffer
                Dev({ [`DNS response source`]: { rinfo } }, { logName: `dns` });

                client.close();
                resolve(Uint8Array.from(msg));
            });

            client.on(`error`, (err) => {
                Warn({ [`DNS query via UDP error`]: err, dnsQuery }, { logName: `dns` });

                client.close();
                reject(err);
            });

            // // Assign a random port
            // let portRange = [49152, 65535],
            //     randomPort = Math.round(Math.random() * (portRange[1] - portRange[0])) + portRange[0];

            // client.bind({ port: randomPort });
            // Use 0
            client.bind({ port: 0 });
        });
    }

    private async dnsOverHttpsLookup(dnsQuery: DNSMessage): Promise<Uint8Array> {
        const dohResolver = await this.resolveHostForDnsOverHttpsRequests();

        Trace(`Resolving query in forward D-o-H DNS`, { logName: `dns` });

        const request: HttpRequestOptions = {
            hostname: dohResolver.ips[0],
            path: dohResolver.resolver.doh.path,
            headers: {
                [`Host`]: dohResolver.resolver.doh.hostname,
                [`Content-Length`]: dnsQuery.typedMessage.length,
            },
        };

        const useMethod = dohResolver.resolver.doh.methods.find(method => { return method.method == dohResolver.resolver.doh.defaultMethod; });

        request.method = useMethod.method;
        useMethod.headers.forEach(header => {
            for (const name in header)
                request.headers[name] = header[name];
        });

        Dev({ [`DoH request`]: request }, { logName: `dns` });

        return new Promise((resolve, reject) => {
            const req = WebRequest(request, res => {
                Trace({ [`DoH response`]: { status: res.statusCode, headers: res.headers } }, { logName: `dns` });

                const data: Array<Uint8Array> = [];
                let totalLength = 0;

                res.on(`data`, chunk => {
                    // chunk is a buffer; store as uint8array
                    const chunkData = new Uint8Array(chunk);
                    totalLength += chunkData.length;
                    Dev({ [`Data chunk`]: chunkData.toString() }, { logName: `dns` });
                    data.push(chunkData);
                });

                res.on(`end`, () => {
                    Dev({ data }, { logName: `dns` });
                    const dataArray = new Uint8Array(totalLength);
                    let offset = 0;
                    while (data.length > 0) {
                        const nextArray = data.shift();
                        dataArray.set(nextArray, offset);
                        offset += nextArray.length;
                    }

                    resolve(dataArray);
                });
            });

            req.on(`error`, (err) => {
                Err(err, { logName: `dns` });
                reject(err);
            });

            // ClientRequest.write() only accepts string or Buffer
            req.write(Buffer.from(dnsQuery.typedMessage));
            req.end();
        });
    }

    /**
     * Use a DNS query to resolve the D-o-H server name
     * @returns The D-o-H server configuration, and the resolved IPs
     */
    private async resolveHostForDnsOverHttpsRequests() {
        const resolver = this.getPrimaryForwardResolver();

        Trace({ [`Loading resolver`]: resolver }, { logName: `dns` });

        // Create a DNS Query for the resolver's hostname
        const resolverQuery = new DNSMessage();
        resolverQuery.AddQuestions([resolver.doh.hostname]);
        resolverQuery.Generate();

        const resolverAnswer = await this.ResolveQuery(resolverQuery, null, false);
        Trace({ resolverAnswer }, { logName: `dns` });

        // Get the IPs for the resolver
        const resolverIPs: Array<string> = [];
        resolverAnswer.answers.forEach(answer => {
            answer.rdata.forEach(ip => {
                if (resolverIPs.indexOf(ip) < 0)
                    resolverIPs.push(ip);
            });
        });

        // Return the resolver data, and the IPs
        return { resolver, ips: resolverIPs };
    }

    //#endregion Look Up In DNS

    /**
     * Get the answer to a query
     * @param dnsQuery - Incoming DNS request
     * @param requestSource - DGram information about the source of the request
     * @param useDNSOverHttps - Pass a non-cached request through the DNS-over-HTTPS resolver instead of using standard DNS protocol
     */
    public async ResolveQuery(dnsQuery: DNSMessage, requestSource: dgram.RemoteInfo, useDNSOverHttps = true): Promise<DNSMessage> {
        const skipAnswerProcessing = this.multiQuestionQuery(dnsQuery) || this.nonInternetClassQuery(dnsQuery);

        let answerMessage: DNSMessage = this.checkCacheForAnswer(dnsQuery);

        // If the cache doesn't hold a record for the query, forward query
        if (!answerMessage)
            answerMessage = await this.answerViaLookup(dnsQuery, useDNSOverHttps);

        // Non-standard queries will return as-resolved
        if (!skipAnswerProcessing) {
            // Any CNAMEs in the answer require a sub-query to resolve
            const cnameAnswers = answerMessage.answers.filter(ans => (ans.typeId == eDnsType.CNAME));

            Trace({ cnameAnswers }, { logName: `dns` });

            while (cnameAnswers.length > 0) {
                const subQuery = new DNSMessage();
                // Assume only one value in rdata when it's a CNAME
                subQuery.AddQuestions([cnameAnswers.shift().rdata[0]]);
                subQuery.Generate();

                const subAnswer = await this.ResolveQuery(subQuery, requestSource);

                answerMessage.AddAnswers(subAnswer.answers);
            }

            // With the expanded answers, create a new response message

            Dev({ [`Unmanipulated answer`]: answerMessage, nscount: answerMessage.nscount });

            // Anything not expected should return unmanipulated
            if ((answerMessage.answers.length > 0) && (answerMessage.nscount == 0)) {
                Dev(`Generating answer`);
                const answerToReturn = new DNSMessage();
                answerToReturn.AddQuestions(dnsQuery.questions.map(question => question.label));
                answerToReturn.AddAnswers(answerMessage.answers);
                answerToReturn.Generate(dnsQuery.queryId, true, dnsQuery.rd);

                Trace({ answerToReturn }, { logName: `dns` });

                answerMessage = answerToReturn;
            } else
                Dev(`Sending unmanipulated answer as response`);
        }

        return answerMessage;
    }
}

export {
    Resolver,
};
