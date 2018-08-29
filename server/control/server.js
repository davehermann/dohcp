// Node/NPM modules
const http = require(`http`);

// Application modules
const { MatchPath } = require(`./pathMatch`),
    { Info } = require(`../logging`),
    { ActiveAllocations } = require(`../dhcp/dhcpServer`),
    { DhcpClientHistory } = require(`../dhcp/history`),
    { ListCache } = require(`../dns/cache`);

function dataServer(configuration) {
    const server = http.createServer((req, res) => {
        let requestAction = `${req.method}:${req.url}`,
            pResponse = Promise.resolve();

        MatchPath(req, `GET:/dhcp/leases`, () => { pResponse = dhcpListLeases(configuration); });
        MatchPath(req, `GET:/dhcp/leases/active`, () => { pResponse = dhcpListLeases(configuration, true); });
        MatchPath(req, `GET:/dhcp/leases/previous`, () => { pResponse = dhcpListLeases(configuration, false, true); });
        MatchPath(req, `GET:/dhcp/leases/all`, () => { pResponse = dhcpListLeases(configuration, false, false, true); });
        MatchPath(req, `GET:/dns/cache-list`, () => { pResponse = dnsListCache(configuration); });
        MatchPath(req, `GET:/dns/cache-list/all`, () => { pResponse = dnsListCache(configuration, true); });
        MatchPath(req, `GET:/dhcp/history/:clientId`, (params) => { pResponse = dhcpHistory(configuration, params); });

        pResponse
            .then(data => {
                res.writeHead(200, { [`Content-Type`]: `application/json` });
                res.write(data);
                res.end();
            });
    });

    server.on(`listening`, () => {
        Info(`Starting data server`);
        Info(server.address());
    });

    server.listen({ host: configuration.serverIpAddress, port: 45332 });
}

function dnsListCache(configuration, includeAll) {
    if (configuration.dns.disabled)
        return Promise.resolve(JSON.stringify({ disabled: true }));

    let fullCache = ListCache();

    let filterList = [];
    for (let hostname in fullCache) {
        let cacheEntry = fullCache[hostname];

        if (includeAll || !cacheEntry.startingTTL)
            filterList.push(cacheEntry);
    }

    return Promise.resolve(JSON.stringify(filterList));
}

function dhcpListLeases(configuration, allActive, allPrevious, allData) {
    if (configuration.dhcp.disabled)
        return Promise.resolve(JSON.stringify({ disabled: true }));

    let leases = ActiveAllocations(),
        leaseData = [],
        otherData = undefined,
        currentTime = (new Date()).getTime();

    for (let ipAddress in leases.byIp) {
        let allocatedAddress = leases.byIp[ipAddress];

        // By-default, only send known leases - i.e. leases that have not expired, and have been given out since the server was last started
        if (!allActive && !allPrevious && !allData) {
            if (!!allocatedAddress && allocatedAddress.setInSession && (allocatedAddress.leaseExpirationTimestamp > currentTime))
                leaseData.push(allocatedAddress);
        } else if (allActive) {
            // Active leases include unexpired leases that may predate the last restart
            if (!!allocatedAddress && (allocatedAddress.leaseStart + (configuration.dhcp.leases.pool.leaseSeconds * 1000) > currentTime))
                leaseData.push(allocatedAddress);
        } else if (allPrevious || allData) {
            // Previous leases includes any IP that the service has ever assigned in the pool
            if (!!allocatedAddress)
                leaseData.push(allocatedAddress);
        }
    }

    // All data adds known client assignments that may not have been assigned by the service
    if (allData) {
        otherData = [];

        for (let clientId in leases.byClientId) {
            let allocatedAddress = leases.byIp[leases.byClientId[clientId]];

            if (!allocatedAddress)
                otherData.push({ clientId, ip: leases.byClientId[clientId] });
        }
    }

    return Promise.resolve(JSON.stringify({ configuration, leaseData, otherData }));
}

function dhcpHistory(configuration, params) {
    if (configuration.dhcp.disabled)
        return Promise.resolve(JSON.stringify({ disabled: true }));

    let history = DhcpClientHistory(params.clientId);
    return Promise.resolve(JSON.stringify({ history }));
}

module.exports.DataServer = dataServer;
