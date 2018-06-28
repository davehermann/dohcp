// Node/NPM modules
const fs = require(`fs`),
    path = require(`path`),
    readline = require(`readline`);

// Application modules
const { SelectInterface } = require(`./shared`);

const CONFIGURATION_FILE = path.join(process.cwd(), `configuration.json`);

let config = {
    logLevel: `info`,
    interface: null,
    dhcp: {
        disabled: true,
    },
    dns: {
        disabled: false,
        servers: [`primaryIP`],
        domain: null,
        records: [],
    }
};

function newConfiguration() {
    // Check for an existing configuration, and do not overwrite
    return existingConfiguration()
        // Select network interface
        .then(() => SelectInterface())
        .then(interfaceDetails => {
            config.interface = interfaceDetails.interfaceName;
        })
        // Add DHCP
        // Ask for lease time, network mask, address range
        // Add DNS
        // Ask for suffix TLD
        .then(() => dnsSuffix())
        // Write the configuration
        .then(() => writeConfiguration());
}

function existingConfiguration() {
    return new Promise((resolve, reject) => {
        fs.stat(CONFIGURATION_FILE, (err) => {
            if (!!err) {
                if (err.code == `ENOENT`)
                    resolve(false);
                else
                    reject(err);
            } else
                resolve(true);
        });
    })
        .then(fileExists => {
            if (fileExists)
                return Promise.reject(new Error(`${CONFIGURATION_FILE} already exists`));

            return Promise.resolve();
        });
}

function dnsSuffix() {
    // eslint-disable-next-line no-console
    console.log(`Do you have a top-level-domain name to append to local devices?`);

    return new Promise(resolve => {
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(`TLD (blank for none): `, (tld) => {
            rl.close();

            resolve(tld.trim());
        });
    })
        .then(tld => {
            if (!!tld)
                config.dns.domain = tld;

            return Promise.resolve();
        });
}

function writeConfiguration() {
    return new Promise((resolve, reject) => {
        fs.writeFile(CONFIGURATION_FILE, JSON.stringify(config, null, 4), { encoding: `utf8` }, (err) => {
            if (!!err)
                reject(err);
            else
                resolve();
        });
    });
}

module.exports.GenerateConfiguration = newConfiguration;
