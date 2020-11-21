// NPM Modules
import { Dev, Trace, Debug } from "multi-level-logger";

// Application Modules
import { Cache, CachedAnswer } from "../dns-cache";
import { DNSMessage } from "../rfc1035/dnsMessage";

/**
 * Try to answer a DNS query from cache
 * @param dnsQuery - Query to check
 */
function checkCacheForAnswer(dnsQuery: DNSMessage, cache: Cache): DNSMessage {
    let answerMessage: DNSMessage = null;

    // Check cache first, but only for single-question queries
    if (dnsQuery.qdcount === 1) {
        const label = dnsQuery.questions[0].label,
            cacheId = Cache.GenerateCacheId(dnsQuery.questions[0]),
            cacheHit = cache.FindInCache(cacheId);

        Debug({ label, cacheId, cacheHit }, { logName: `dns` });

        if (!!cacheHit)
            answerMessage = respondFromCache(dnsQuery, cacheHit);
    }

    return answerMessage;
}

/**
 * Use a cached DNS answer as the answer to a new query
 * @param dnsQuery - Query to check
 * @param cachedAnswer - Answer from the stored cache
 */
function respondFromCache(dnsQuery: DNSMessage, cachedAnswers: Array<CachedAnswer>) {
    Trace(`Found in cache - responding from cache`, { logName: `dns` });
    Dev({ dnsQuery, cachedAnswers }, { logName: `dns` });

    // Create a new message
    const dnsAnswer = new DNSMessage();

    // Add the matching answers
    dnsAnswer.AddAnswers(cachedAnswers.map(answer => answer.answer));

    return dnsAnswer;
}

export {
    checkCacheForAnswer as CheckForAnswerInCache,
};
