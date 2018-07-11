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

function dnsListCache() {
    let fullCache = ListCache();

    return Promise.resolve(JSON.stringify(fullCache));
}

module.exports.DataServer = dataServer;
