// Node/NPM modules
const os = require(`os`),
    readline = require(`readline`);

const TABS = `    `;

function selectInterface() {
    let interfaces = os.networkInterfaces(),
        available = [];

    for (let name in interfaces)
        available.push({
            name,
            addressing: interfaces[name]
        });

    // eslint-disable-next-line no-console
    console.log(`Available network interfaces`);
    available.forEach(i => {
        // eslint-disable-next-line no-console
        console.log(`${TABS}${i.name}: ${i.addressing.map(a => { return `${a.family} - ${a.address}`; }).join(`, `)}`);
    });

    return new Promise(resolve => {
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(`Bind to interface: `, (interfaceName) => {
            rl.close();

            resolve(interfaceName.trim());
        });
    })
        .then(interfaceName => {
            if (!interfaces[interfaceName]) {
                // eslint-disable-next-line no-console
                console.log(`\nINTERFACE '${interfaceName}' NOT FOUND\n`);
                return selectInterface();
            } else
                return Promise.resolve({ interfaceName, addresses: interfaces[interfaceName] });
        });
}

module.exports.TABS = TABS;
module.exports.SelectInterface = selectInterface;
