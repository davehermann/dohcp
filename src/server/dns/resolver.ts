// Node Modules
import * as dgram from "dgram";
import { request as WebRequest, RequestOptions as HttpRequestOptions } from "https";

// NPM Modules
import { Dev, Trace, Debug, Warn, Info, Err } from "multi-level-logger";

// Application Modules
import { AddForwardedAnswerToCache } from "./cache";
import { CheckForAnswerInCache } from "./resolver/cacheInteraction";
import { DNSMessage } from "./rfc1035/dnsMessage";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { eDnsClass, eDnsType } from "../../interfaces/configuration/dns";

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
 * Get the answer to a query
 * @param dnsQuery - Incoming DNS request
 * @param configuration - Server configuration
 * @param requestSource - DGram information about the source of the request
 * @param useDNSOverHttps - Pass a non-cached request through the DNS-over-HTTPS resolver instead of using standard DNS protocol
 */
async function resolveQuery(dnsQuery: DNSMessage, configuration: IConfiguration, requestSource: dgram.RemoteInfo, useDNSOverHttps = true): Promise<DNSMessage> {
    const skipAnswerProcessing = multiQuestionQuery(dnsQuery) || nonInternetClassQuery(dnsQuery);

    let answerMessage: DNSMessage = CheckForAnswerInCache(dnsQuery);

    // If the cache doesn't hold a record for the query, forward query
    if (!answerMessage)
        answerMessage = await answerViaLookup(dnsQuery, configuration, useDNSOverHttps);

    // Non-standard queries will return as-resolved
    if (!skipAnswerProcessing) {
        // If the last answer in the answer's list is a CNAME, perform a sub-query
        const lastAnswer = answerMessage.answers[answerMessage.answers.length - 1];

        if (!lastAnswer)
            Info({ [`NO lastAnswer`]: dnsQuery.questions, requestSource }, { logName: `dns` });

        if (!!lastAnswer && (lastAnswer.typeId == eDnsType.CNAME)) {
            const subQuery = new DNSMessage();
            subQuery.AddQuestions([lastAnswer.rdata[0]]);
            subQuery.Generate();

            const subAnswer = await resolveQuery(subQuery, configuration, requestSource);

            answerMessage.AddAnswers(subAnswer.answers);
        }


        // With the expanded answers, create a new response message

        Dev({ [`Unmanipulated answer`]: answerMessage, nscount: answerMessage.nscount, lastAnswer });

        // Anything not expected should return unmanipulated
        if (!!lastAnswer && ((answerMessage.nscount === 0) || (answerMessage.nscount === null) || (answerMessage.nscount === undefined))) {
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

/**
 * Query a DNS-over-HTTPS service, or a forward DNS server, for the answer
 * @param dnsQuery - Incoming DNS request
 * @param configuration - Server configuration
 * @param useDNSOverHttps - Pass a non-cached request through the DNS-over-HTTPS resolver instead of using standard DNS protocol
 */
async function answerViaLookup(dnsQuery: DNSMessage, configuration: IConfiguration, useDNSOverHttps: boolean): Promise<DNSMessage> {
    Trace(`Forwarding to public resolver (via ${useDNSOverHttps ? `DNS-over-HTTPS` : `DNS`})`, { logName: `dns` });

    let responseFromForwardDNS: Uint8Array;
    if (useDNSOverHttps)
        responseFromForwardDNS = await dnsOverHttpsLookup(dnsQuery, configuration);
    else
        responseFromForwardDNS = await dnsLookup(dnsQuery, configuration);

    Trace({ [`Complete Response`]: responseFromForwardDNS.reduce((prev, cur) => { return prev + cur.toString(16).padStart(2, `0`); }, ``) }, { logName: `dns` });

    const answerMessage: DNSMessage = new DNSMessage();
    answerMessage.FromDNS(responseFromForwardDNS);
    Debug({ answerMessage }, { logName: `dns` });

    // Do not cache Authoritative responses
    if (answerMessage.nscount == 0)
        AddForwardedAnswerToCache(answerMessage);

    return answerMessage;
}

async function dnsOverHttpsLookup(dnsQuery: DNSMessage, configuration: IConfiguration): Promise<Uint8Array> {
    const dohResolver = await resolveHostForDnsOverHttpsRequests(configuration);

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

function dnsLookup(dnsQuery: DNSMessage, configuration: IConfiguration): Promise<Uint8Array> {
    const resolver = getPrimaryForwardResolver(configuration);

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
 * @returns The D-o-H server configuration, and the resolved IPs
 */
async function resolveHostForDnsOverHttpsRequests(configuration: IConfiguration) {
    const resolver = getPrimaryForwardResolver(configuration);

    Trace({ [`Loading resolver`]: resolver }, { logName: `dns` });

    // Create a DNS Query for the resolver's hostname
    const resolverQuery = new DNSMessage();
    resolverQuery.AddQuestions([resolver.doh.hostname]);
    resolverQuery.Generate();

    const resolverAnswer = await resolveQuery(resolverQuery, configuration, null, false);
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

/** Check configuration for the resolver to use */
function getPrimaryForwardResolver(configuration: IConfiguration) {
    return configuration.dns.upstream.resolvers.find(resolver => (resolver.name == configuration.dns.upstream.primary));
}

export {
    resolveQuery as ResolveDNSQuery,
};
