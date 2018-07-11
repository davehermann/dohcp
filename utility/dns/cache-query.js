// Node/NPM modules
const http = require(`http`);

function queryCache(action, allActions, configuration) {
    http.get(
        {
            host: configuration.serverIpAddress,
            port: 45332,
            path: `/dns/cache-list`,
        },
        (res) => {
            let data = ``;
            res.on(`data`, (chunk) => {
                data += chunk;
            });
            res.on(`end`, () => {
                let cacheMap = JSON.parse(data);

                for (let query in cacheMap) {
                    let answer = cacheMap[query];

                    let report = `${answer.label} --> ${answer.rdata}`;
                    if (!!answer.startingTTL)
                        report += ` (exp: ${answer.startingTTL} sec)`;

                    // eslint-disable-next-line no-console
                    console.log(report);
                }
            });
        }
    );
}

module.exports.DNSCache = queryCache;
