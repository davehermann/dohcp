// NPM Modules
import { Trace, Debug } from "multi-level-logger";

// Application Modules
import { Answer } from "./rfc1035/answer";
import { DNSMessage } from "./rfc1035/dnsMessage";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { eDnsClass, eDnsType, ICacheId, IRegisteredHost } from "../../interfaces/configuration/dns";

const _cache: Map<string, Answer> = new Map();

/**
 * Add A and CNAME records to cached data from configuration
 * @param configuration - Base server configuration
 */
function addFromConfiguration(configuration: IConfiguration): void {
    if (!!configuration.dns.records) {
        // Copy the records data
        const records = configuration.dns.records.filter(() => true);

        // Also add any statically-assigned DHCP addresses
        if (!!configuration.dhcp && !configuration.dhcp.disabled) {
            const staticLeaseAssignments = configuration.dhcp.leases?.static;
            if (!!staticLeaseAssignments) {
                for (const [ macAddress, assignment] of staticLeaseAssignments.entries())
                    if (!!assignment.hostname)
                        records.push({ name: assignment.hostname, ip: assignment.ip });
            }
        }

        // Add the defined domain to each hostname
        if (!!configuration.dns.domain && (configuration.dns.domain.length > 0))
            records.forEach(record => {
                // To the label if it isn't included
                if (record.name.search(new RegExp(`${configuration.dns.domain.replace(/\./g, `\\.`)}$`)) < 0) {
                    const copy: IRegisteredHost = JSON.parse(JSON.stringify(record));

                    copy.name += `.${configuration.dns.domain}`;

                    records.push(copy);
                }
            });

        records.forEach(record => {
            const answer = new Answer(),
                ttl = null;
            answer.label = record.name;
            answer.typeId = (!!record.alias ? eDnsType.CNAME : eDnsType.A);
            answer.classId = eDnsClass.IN;
            answer.rdata.push(record.alias || record.ip);

            storeInCache(answer, ttl);
        });
    }
}

/** Add answers from within a DNS Message */
function addFromForwardDns(dnsAnswer: DNSMessage): void {
    dnsAnswer.answers.forEach(answer => {
        // Calculate the remaining TTL
        const currentTime = new Date(),
            remainingTTL = Math.round((answer.ttlExpiration - currentTime.getTime()) / 1000);

        // Only cache if TTL is > 1000
        if (remainingTTL > 1) {
            Debug(`Adding ${answer.label} to cache with removal in ${remainingTTL} seconds`, { logName: `dns` });

            storeInCache(answer, remainingTTL);
        }
    });
}

/** Store a DNS answer in cache for reuse */
function storeInCache(answer: Answer, ttl: number) {
    const cacheId = generateCacheId(answer);

    const existingAnswer = lookupInCache(cacheId);
    if (!!existingAnswer) {
        Trace(`${cacheId} found in cache. Cleaning up before re-adding${!!existingAnswer.cacheRemoval ? `, including resetting cache timeout` : ` - no cache timeout found`}.`, { logName: `dns` });

        // Clear the TTL removal
        if (!!existingAnswer.cacheRemoval)
            clearTimeout(existingAnswer.cacheRemoval);

        // Remove from cache
        removeFromCache(cacheId);
    }

    // Add an expiration for DHCP-configured leases
    if (!!ttl)
        answer.cacheRemoval = setTimeout(() => { removeFromCache(cacheId); }, ttl * 1000);
    else
        answer.noExpiration = true;

    Debug({ [`New cache entry - ${cacheId.toLowerCase()}`]: answer, ttl }, { logName: `dns` });

    _cache.set(cacheId.toLowerCase(), answer);
}

/** Find a matching cache entry for the cache ID, if one exists */
function lookupInCache(cacheId: string): Answer {
    const { label, typeId, classId } = parseCacheId(cacheId);
    let cacheHit = _cache.get(cacheId.toLowerCase()),
        cacheReturn: Answer = null;

    // Check CNAME aliases for A or AAAA records
    if (!cacheHit && ((typeId == eDnsType.A) || (typeId == eDnsType.AAAA)))
        cacheHit = _cache.get(generateCacheId({ label, typeId: eDnsType.CNAME, classId }));

    if (!!cacheHit) {
        // Use a copy of the cached object
        cacheReturn = cacheHit.Clone();

        // And match the query casing in the return
        cacheReturn.label = label;
    }

    return cacheReturn;
}

/**
 * Remove a label from cache
 * @param cacheId - Label for the cache item
 */
function removeFromCache(cacheId: string): void {
    // Remove the entry
    Trace(`${cacheId.toLowerCase()} removed from cache`, { logName: `dns` });
    _cache.delete(cacheId.toLowerCase());
}

/** Get an ID for cached based on the DNS Message */
function generateCacheId(cacheDefinition: Answer | ICacheId): string {
    return `${cacheDefinition.label}:${cacheDefinition.typeId}:${cacheDefinition.classId}`;
}

/** Parse an ID stored in cache */
function parseCacheId(cacheId: string): ICacheId {
    const idParts = cacheId.split(`:`),
        label = idParts[0],
        typeId: eDnsType = eDnsType[eDnsType[+idParts[1]]],
        classId: eDnsClass = eDnsClass[eDnsClass[+idParts[2]]];

    return { label, typeId, classId };
}

/** Return the entire cache */
function cacheContents(): Map<string, Answer> {
    // Return the cache
    return _cache;
}

export {
    addFromConfiguration as LoadPreconfiguredRecords,
    addFromForwardDns as AddForwardedAnswerToCache,
    cacheContents as CacheContents,
    generateCacheId as GenerateCacheId,
    lookupInCache as FindInCache,
};
