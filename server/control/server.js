// Node/NPM modules
const http = require(`http`);

// Application modules
const { Info } = require(`../logging`);

function dataServer(configuration) {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { [`Content-Type`]: `application/json` });
        res.write(JSON.stringify({}));
        res.end();
    });

    server.on(`listening`, () => {
        Info(`Starting data server`);
        Info(server.address());
    });

    server.listen({ host: configuration.serverIpAddress, port: 45332 });
}

module.exports.DataServer = dataServer;
