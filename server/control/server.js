// Node/NPM modules
const http = require(`http`);

// Application modules
const { Info } = require(`../logging`),
    { ListCache } = require(`../dns/cache`);

function dataServer(configuration) {
    const server = http.createServer((req, res) => {
        let requestAction = `${req.method}:${req.url}`,
            pResponse = Promise.resolve();

        switch (requestAction) {
            case `GET:/dns/cache-list`:
                pResponse = dnsListCache();
                break;
            case `GET:/dns/cache-list/all`:
                pResponse = dnsListCache(true);
                break;
        }

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

function dnsListCache(includeAll) {
    let fullCache = ListCache();

    let filterList = [];
    for (let hostname in fullCache) {
        let cacheEntry = fullCache[hostname];

        if (includeAll || !cacheEntry.startingTTL)
            filterList.push(cacheEntry);
    }

    return Promise.resolve(JSON.stringify(filterList));
}

module.exports.DataServer = dataServer;
