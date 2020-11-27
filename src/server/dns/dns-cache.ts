import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { IRegisteredHost, eDnsType, eDnsClass, ICacheId } from "../../interfaces/configuration/dns";
import { Answer } from "./rfc1035/answer";
import { Trace, Dev, Debug } from "multi-level-logger";
import { DNSMessage } from "./rfc1035/dnsMessage";

class CachedAnswer {
    constructor(answer: Answer, id?: number, removal?: ReturnType<typeof setTimeout>) {
        this.answer = answer;
        this.id = id;
        this.cacheRemoval = removal;
    }

    public id: number;
    public cacheRemoval: ReturnType<typeof setTimeout>;
    public answer: Answer;

    public toJSON(): any {
        const data = {
            id: this.id,
            answer: this.answer
        };

        return data;
    }
}

class Cache {
    constructor(private readonly configuration: IConfiguration) {}

    //#region Properties

    private readonly _cache: Map<string, Array<CachedAnswer>> = new Map();

    //#endregion

    public get cacheContents(): Map<string, Array<CachedAnswer>> { return this._cache; }

    //#region Static Methods

    /** Get an ID for cached based on the DNS Message */
    public static GenerateCacheId(cacheDefinition: ICacheId): string {
        return `${cacheDefinition.label}:${cacheDefinition.typeId}:${cacheDefinition.classId}`;
    }

    /** Parse an ID stored in cache */
    private static ParseCacheId(cacheId: string): ICacheId {
        const idParts = cacheId.split(`:`),
            label = idParts[0],
            typeId: eDnsType = eDnsType[eDnsType[+idParts[1]]],
            classId: eDnsClass = eDnsClass[eDnsClass[+idParts[2]]];

        return { label, typeId, classId };
    }

    //#endregion Static Methods

    //#region Private Methods

    /**
     * Add domain record sets to the cached entries
     * @param records - List of A or CNAME records to add
     * @param ttl - Time-to-live for the address record, if the record should be expired at some point
     */
    private addRecordsToCache(records: Array<IRegisteredHost>, ttl: number = null): void {
        // Add the defined domain to each hostname
        if (!!this.configuration.dns.domain && (this.configuration.dns.domain.length > 0))
            records.forEach(record => {
                // To the label if it isn't included
                if (record.name.search(new RegExp(`${this.configuration.dns.domain.replace(/\./g, `\\.`)}$`)) < 0) {
                    const copy: IRegisteredHost = JSON.parse(JSON.stringify(record));

                    copy.name += `.${this.configuration.dns.domain}`;

                    records.push(copy);
                }
            });

        records.forEach(record => {
            const answer = new Answer();
            answer.label = record.name;
            answer.typeId = (!!record.alias ? eDnsType.CNAME : eDnsType.A);
            answer.classId = eDnsClass.IN;
            answer.rdata.push(record.alias || record.ip);

            this.storeInCache(answer, ttl);
        });
    }

    /** Add A and CNAME records to cached data from configuration */
    private addRecordsFromConfiguration(): void {
        if (!!this.configuration?.dns?.records) {
            // Create a copy of the records data
            const records = this.configuration.dns.records.filter(() => true);

            // Also add any statically-assigned DHCP addresses
            if (!!this.configuration.dhcp && !this.configuration.dhcp.disabled) {
                const staticLeaseAssignments = this.configuration.dhcp.leases?.static;
                if (!!staticLeaseAssignments) {
                    for (const [ macAddress, assignment] of staticLeaseAssignments.entries())
                        if (!!assignment.hostname)
                            records.push({ name: assignment.hostname, ip: assignment.ip });
                }
            }

            this.addRecordsToCache(records);
        }
    }

    /** Store a DNS answer in cache for reuse */
    private storeInCache(answer: Answer, ttl: number): void {
        const cacheId = Cache.GenerateCacheId(answer),
            idInCache = cacheId.toLowerCase();

        const existingAnswers = this.FindInCache(cacheId);
        if (!!existingAnswers) {
            Dev({ [`${cacheId} found in cache.`]: existingAnswers });

            // Check for an existing answer in cache that matches this one
            const matchingAnswer = existingAnswers.find(existing => {
                // If the existing answer from cache and the new answer both have the same rdata length
                if (existing.answer.rdata.length == answer.rdata.length) {
                    // Get the list of IPs/names in the existing cache entry's rdata field that match the new answer's rdata
                    const responseList = existing.answer.rdata.filter(data => (answer.rdata.indexOf(data) >= 0));

                    // If the entire response list is included it's a matching entry
                    if (responseList.length == existing.answer.rdata.length)
                        return true;
                }

                return false;
            });

            // If a match is found, drop it from cache
            if (!!matchingAnswer) {
                Trace({ [`Existing cache entry for new ${cacheId} answer found`]: matchingAnswer });

                this.removeFromCache(cacheId, matchingAnswer.id);
            }
        } else
            Dev(`No current record for ${cacheId} found in cache`);

        // Ensure the cache ID is in the cache
        if (!this._cache.has(idInCache)) {
            Debug(`Adding ${idInCache} to cache`);

            this._cache.set(idInCache, []);
        }

        // Get the cache list
        const useCache = this._cache.get(idInCache);

        // Create an answer in cache
        const cacheAnswer: CachedAnswer = new CachedAnswer(answer.Clone());

        // Generate a unique ID
        while ((cacheAnswer.id === undefined) || !!useCache.find(ans => (ans.id == cacheAnswer.id)))
            cacheAnswer.id = Math.round(Math.random() * 10000000);

        // Handle removal
        if (!!ttl)
            cacheAnswer.cacheRemoval = setTimeout(() => this.removeFromCache(cacheId, cacheAnswer.id), ttl * 1000);
        else {
            answer.noExpiration = true;
            cacheAnswer.answer.noExpiration = true;
        }

        // Add the answer to the cache list
        useCache.push(cacheAnswer);

        Debug({ [`New cache entry - ${cacheAnswer.id} in ${idInCache}`]: cacheAnswer, ttl }, { logName: `dns` });
    }

    /**
     * Remove a label from cache
     * @param cacheId - Label for the cache item
     */
    private removeFromCache(cacheId: string, answerIdToRemove: number): void {
        const idInCache = cacheId.toLowerCase(),
            answerList = this._cache.get(idInCache);

        // Remove the entry
        Trace(`Dropping ${answerIdToRemove} from ${idInCache}`);

        const idxToRemove = answerList.findIndex(cachedAnswer => (cachedAnswer.id == answerIdToRemove));

        const removedAnswer = answerList.splice(idxToRemove, 1)[0];

        // Clear the timeout for removal
        if (!!removedAnswer.cacheRemoval)
            clearTimeout(removedAnswer.cacheRemoval);

        // If the cache is empty, drop it
        if (answerList.length == 0) {
            this._cache.delete(idInCache);
            Trace(`${idInCache} removed from cache`);
        }
    }

    //#endregion Private Methods

    /**
     * Find a matching cache entry for the cache ID, if one exists
     * @param cacheId - The generated ID for the domain name
     */
    public FindInCache(cacheId: string): Array<CachedAnswer> {
        const { label, typeId, classId } = Cache.ParseCacheId(cacheId);

        // Look up using lower case
        let cacheHit = this._cache.get(cacheId.toLowerCase()),
            cachedAnswers: Array<CachedAnswer> = null;

        // Check CNAME aliases for A or AAAA records
        if (!cacheHit && ((typeId == eDnsType.A) || (typeId == eDnsType.AAAA)))
            cacheHit = this._cache.get(Cache.GenerateCacheId({ label, typeId: eDnsType.CNAME, classId }).toLowerCase());

        if (!!cacheHit) {
            cachedAnswers = [];

            cacheHit.forEach(answer => {
                // Use a copy of the cached entry, with the label matching the casing of the query
                const clonedAnswer: CachedAnswer = new CachedAnswer(answer.answer.Clone(), answer.id, answer.cacheRemoval);

                // And match the query casing in the return
                clonedAnswer.answer.label = label;

                cachedAnswers.push(clonedAnswer);
            });
        }

        return cachedAnswers;
    }

    /** Add answers from within a DNS Message */
    public AddFromForwardDns(dnsAnswer: DNSMessage): void {
        dnsAnswer.answers.forEach(answer => {
            // Calculate the remaining TTL
            const currentTime = new Date(),
                remainingTTL = Math.round((answer.ttlExpiration - currentTime.getTime()) / 1000);

            // Only cache if TTL is > 1000
            if (remainingTTL > 1) {
                Debug(`Adding ${answer.label} to cache with removal in ${remainingTTL} seconds`, { logName: `dns` });

                this.storeInCache(answer, remainingTTL);
            }
        });
    }

    /**
     * Add a DNS record based on the DHCP request and allocation
     * @param uniqueHostname - The hostname provided to - or by - the client
     * @param ipAddress - The allocated IP after assignment to the client
     * @param uniqueClientId - The client-provided unique hardware identifier
     * @param vendorClassIdentifier - A vendor-provided identifier from the client
     * @param domainSuffix - The configured suffix for all hosts supplied by this system
     * @param ttl - DHCP lease expiration length
     */
    public AddFromDHCP(uniqueHostname: string, ipAddress: string, uniqueClientId: string, vendorClassIdentifier: string, ttl: number): string {
        // If no hostname is available, use the vendor identifier plus a letter
        if (!uniqueHostname) {
            let randomizedAddress = vendorClassIdentifier;

            if (!!randomizedAddress && (randomizedAddress.length > 0)) {
                // Append a letter to the identifier
                let useChar = 65;
                while (!!this._cache.has(`${randomizedAddress}-${String.fromCharCode(useChar)}`))
                    useChar++;

                randomizedAddress += `-${String.fromCharCode(useChar)}`;
            }

            if (!!randomizedAddress)
                uniqueHostname = randomizedAddress;
        }

        // If there's still no unique hostname, use the unique ID for the client
        if (!uniqueHostname)
            uniqueHostname = uniqueClientId;
        else {
            // If there is a unique hostname, make sure it doesn't collide with another name, and if it does use the last 6 of the unique ID
            let cacheId: string;
            do {
                cacheId = Cache.GenerateCacheId({ label: uniqueHostname, typeId: eDnsType.A, classId: eDnsClass.IN });
                uniqueHostname += `-${uniqueClientId.substr(uniqueClientId.length - 6)}`;
            } while (this._cache.has(cacheId) && (this._cache.get(cacheId)[0].answer.rdata[0] !== ipAddress));
        }

        // Remove spaces
        uniqueHostname = uniqueHostname.replace(/ /g, `_`);

        this.addRecordsToCache([{ name: uniqueHostname, ip: ipAddress }], ttl);

        return uniqueHostname;
    }


    public Initialize(): void {
        this.addRecordsFromConfiguration();
    }
}

export {
    CachedAnswer,
    Cache,
};
