// Node/NPM modules
const http = require(`http`);

function queryCache(action, allActions, configuration) {
    let urlPath = `/dns/cache-list`;
    if (action.additionalArguments.indexOf(`--all`) >= 0)
        urlPath += `/all`;

    http.get(
        {
            host: configuration.dataServiceHost,
            port: 45332,
            path: urlPath,
        },
        (res) => {
            let data = ``;
            res.on(`data`, (chunk) => {
                data += chunk;
            });

            res.on(`end`, () => {
                let cacheList = JSON.parse(data),
                    currentTime = (new Date()).getTime(),
                    display = [];

                if ((typeof cacheList == `object`) && cacheList.disabled)
                    // eslint-disable-next-line no-console
                    console.log(`\nThe DNS service is not enabled\n`);
                else {
                    cacheList.forEach(answer => {
                        let recordType = `*${answer.typeId}*`;
                        switch (answer.typeId) {
                            case 1:
                                recordType = `A`;
                                break;
                            case 5:
                                recordType = `CNAME`;
                                break;
                            case 28:
                                recordType = `AAAA`;
                                break;
                        }

                        let report = `${answer.label} --> [${recordType}] ${answer.rdata}`;
                        if (!!answer.startingTTL)
                            report += ` (exp: ${Math.round((answer.ttlExpiration - currentTime) / 1000)} sec)`;

                        display.push(report);
                    });

                    // Sort by hostname
                    display.sort((a, b) => { return a < b ? -1 : 1; });

                    // eslint-disable-next-line no-console
                    console.log(`\n---- Entries currently in DNS ----\n${display.join(`\n`)}\n`);
                }
            });
        }
    );
}

module.exports.DNSCache = queryCache;
