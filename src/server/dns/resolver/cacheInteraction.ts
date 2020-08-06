// NPM Modules
import { Dev, Trace, Debug } from "multi-level-logger";

// Application Modules
import { FindInCache, GenerateCacheId } from "../cache";
import { Answer } from "../rfc1035/answer";
import { DNSMessage } from "../rfc1035/dnsMessage";

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
 * Use a cached DNS answer as the answer to a new query
 * @param dnsQuery - Query to check
 * @param cachedAnswer - Answer from the stored cache
 */
function respondFromCache(dnsQuery: DNSMessage, cachedAnswer: Answer) {
    Trace(`Found in cache - responding from cache`, { logName: `dns` });
    Dev({ dnsQuery, cachedAnswer }, { logName: `dns` });

    // Create a new message
    const dnsAnswer = new DNSMessage();

    // Add this answer
    dnsAnswer.AddAnswers([cachedAnswer]);

    return dnsAnswer;
}

export {
    checkCacheForAnswer as CheckForAnswerInCache,
};
