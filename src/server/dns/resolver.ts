// Node Modules
import * as dgram from "dgram";

// NPM Modules
import { Dev, Trace, Debug, Warn } from "multi-level-logger";

// Application Modules
import { FindInCache, GenerateCacheId } from "./cache";
import { Answer } from "./rfc1035/answer";
import { DNSMessage } from "./rfc1035/dnsMessage";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { eDnsClass } from "../../interfaces/configuration/dns";

/**
 * Log queries with more than one question to warn, and don't cache or rewrite the answers
 * @param dnsQuery - Query to check
 * @returns Skip additional processing of the answer
 */
function multiQuestionQuery(dnsQuery: DNSMessage): boolean {
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
function nonInternetClassQuery(dnsQuery: DNSMessage): boolean {
    if (dnsQuery.questions.filter(q => { return q.classId !== eDnsClass.IN; }).length > 0) {
        Warn({ [`NOT 'IN' CLASS QUERY (unexpected)`]: dnsQuery }, { logName: `dns` });
        return true;
    }

    return false;
}

/**
 * Try to answer a DNS query from cache
 * @param dnsQuery - Query to check
 */
function checkCacheForAnswer(dnsQuery: DNSMessage): DNSMessage {
    let answerMessage: DNSMessage = null;

    // Check cache first, but only for single-question queries
    if (dnsQuery.qdcount === 1) {
        const label = dnsQuery.questions[0].label,
            cacheId = GenerateCacheId(dnsQuery.questions[0]),
            cacheHit = FindInCache(cacheId);

        Debug({ label, cacheId, cacheHit }, { logName: `dns` });

        if (!!cacheHit)
            answerMessage = respondFromCache(dnsQuery, cacheHit);
    }

    return answerMessage;
}

/**
 * Get the answer to a query
 * @param dnsQuery - Incoming DNS request
 * @param configuration - Server configuration
 * @param requestSource - DGram information about the source of the request
 * @param useDNSOverHttps - Pass a non-cached request through the DNS-over-HTTPS resolver instead of using standard DNS protocol
 */
async function resolveQuery(dnsQuery: DNSMessage, configuration: IConfiguration, requestSource: dgram.RemoteInfo, useDNSOverHttps = true): Promise<DNSMessage> {
    const skipAnswerProcessing = multiQuestionQuery(dnsQuery) || nonInternetClassQuery(dnsQuery);

    let answerMessage: DNSMessage = checkCacheForAnswer(dnsQuery);

    // If the cache doesn't hold a record for the query, forward query
    if (!answerMessage)
        answerMessage = await answerViaLookup(dnsQuery, configuration, useDNSOverHttps);

    return Promise.resolve(null);
}

/**
 * Use a cached DNS answer as the answer to a new query
 * @param dnsQuery - Query to check
 * @param cachedAnswer - Answer from the stored cache
 */
function respondFromCache(dnsQuery: DNSMessage, cachedAnswer: Answer) {
    Trace(`Responding from cache`, { logName: `dns` });
    Dev({ dnsQuery, cachedAnswer }, { logName: `dns` });

    // Create a new message
    const dnsAnswer = new DNSMessage();

    // Add this answer
    dnsAnswer.AddAnswers([cachedAnswer]);

    return dnsAnswer;
}

/**
 * Query a DNS-over-HTTPS service, or a forward DNS server, for the answer
 * @param dnsQuery - Incoming DNS request
 * @param configuration - Server configuration
 * @param useDNSOverHttps - Pass a non-cached request through the DNS-over-HTTPS resolver instead of using standard DNS protocol
 */
async function answerViaLookup(dnsQuery: DNSMessage, configuration: IConfiguration, useDNSOverHttps: boolean): Promise<DNSMessage> {
    Trace(`Forwarding to public resolver`, { logName: `dns` });

    const responseFromForwardDNS: Buffer = useDNSOverHttps ? await dnsOverHttpsLookup(dnsQuery, configuration) : await dnsLookup(dnsQuery, configuration);

    let answerMessage: DNSMessage;

    return answerMessage;
}

async function dnsOverHttpsLookup(dnsQuery: DNSMessage, configuration: IConfiguration): Promise<Buffer> {
    const dohResolver = resolveHostForDnsOverHttpsRequests(configuration);

    Trace(`Resolving query in forward D-o-H DNS`, { logName: `dns` });

    return Promise.resolve(Buffer.from([]));
}

function dnsLookup(dnsQuery: DNSMessage, configuration: IConfiguration): Promise<Buffer> {
    const resolver = getPrimaryForwardResolver(configuration);

    // Resolve the hostname (may be in cache, or perform a DNS lookup)
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket({ type: `udp4` });

        client.on(`listening`, () => {
            Trace(`DNS query via UDP listening on ${JSON.stringify(client.address())}`, { logName: `dns` });
            Dev({ dnsQuery }, { logName: `dns` });

            client.send(dnsQuery.dnsMessage, 53, resolver.servers[0]);
        });

        client.on(`message`, (msg, rinfo) => {
            Debug({ [`DNS response`]: { rinfo, msg } }, { logName: `dns` });

            client.close();
            resolve(msg);
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

/**
 * Use a DNS query to resolve the D-o-H server name
 * @param configuration - Server configuration
 */
async function resolveHostForDnsOverHttpsRequests(configuration: IConfiguration) {
    const resolver = getPrimaryForwardResolver(configuration);

    Trace({ [`Loading resolver`]: resolver }, { logName: `dns` });

    // Create a DNS Query for the resolver's hostname
    const resolverQuery = new DNSMessage();
    resolverQuery.AddQuestions([resolver.doh.hostname]);
    resolverQuery.Generate();

    const resolverAnswer = resolveQuery(resolverQuery, configuration, null, false);
    Trace({ resolverAnswer }, { logName: `dns` });
}

/** Check configuration for the resolver to use */
function getPrimaryForwardResolver(configuration: IConfiguration) {
    return configuration.dns.upstream.resolvers.find(resolver => (resolver.name == configuration.dns.upstream.primary));
}

export {
    resolveQuery as ResolveDNSQuery,
};
