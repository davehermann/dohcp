// Node/NPM modules
const http = require(`http`);

function queryLeases(action, allActions, configuration) {
    let urlPath = `/dhcp/leases`;

    http.get(
        {
            host: configuration.serverIpAddress,
            port: 45332,
            path: urlPath,
        },
        (res) => {
            let data = ``;
            res.on(`data`, (chunk) => {
                data += chunk;
            });

            res.on(`end`, () => {
                let leases = JSON.parse(data);

                console.log(leases);
            });
        }
    );
}

module.exports.DHCPLeases = queryLeases;
