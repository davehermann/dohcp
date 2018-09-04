// Node/NPM modules
const fs = require(`fs`),
    path = require(`path`),
    readline = require(`readline`);

// Application modules
const { SelectInterface } = require(`./shared`);

const CONFIGURATION_FILE = path.join(__dirname, `..`, `configuration.json`);

let config = {
    logLevel: `warn`,
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
        .then(() => dhcpConfiguration())
        // Add DNS
        // Ask for suffix TLD
        .then(() => dnsSuffix())
        // Write the configuration
        .then(() => writeConfiguration())
        .then(() => {
            // eslint-disable-next-line no-console
            console.log(`\nReview Readme and Configuration documentation for more advanced configuration options.`);

            if (process.platform == `linux`)
                // eslint-disable-next-line no-console
                console.log(`\n--Linux detected--\n1) Run 'dohcp install' to start/enable a systemd unit\n2) See readme for command to allow NodeJS to access lower ports without running as root user\n`);
        });
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

function dhcpConfiguration() {
    return getLineInput(`Configure DHCP? [Y/n]:`)
        .then(answer => { return (!answer || (answer.search(/^Y$/i) == 0)); })
        .then(dhcp => {
            if (dhcp) {
                config.dhcp.disabled = false;
                config.dhcp.authoritative = true;
                config.dhcp.routers = [];

                config.dhcp.leases = {
                    pool: {
                        leaseSeconds: null,
                        networkMask: null,
                        ranges: [],
                    },
                    static: {},
                };

                // Ask Routers
                return dhcpRouters()
                    // Ask Lease Time
                    .then(() => dhcpLeaseLength())
                    // Ask Ranges
                    .then(() => dhcpRange())
                    // Ask Subnet Mask
                    .then(() => dhcpSubnet());
            }
        });
}

function dhcpRouters() {
    return getLineInput(`Enter gateway IPs (comma-separated for multiple):`)
        .then(ips => {
            config.dhcp.routers = ips.split(`,`);
        });
}

function dhcpLeaseLength() {
    return getLineInput(`Time, in seconds, before a DHCP lease expires [default: 3600]:`)
        .then(expirationLength => {
            let val = 3600;

            if (!!expirationLength) {
                val = parseInt(expirationLength, 10);

                if (isNaN(val)) {
                    // eslint-disable-next-line no-console
                    console.log(`Please enter a whole number of seconds.`);
                    return dhcpLeaseLength();
                }
            }

            config.dhcp.leases.pool.leaseSeconds = val;
        });
}

function dhcpRange() {
    if (config.dhcp.leases.pool.ranges.length == 0)
    // eslint-disable-next-line no-console
        console.log(`Add one, or more, address ranges to the pool`);

    let newRange = { start: null, end: null };
    return getLineInput(`Start of range:`)
        .then(rangeStart => { newRange.start = rangeStart; })
        .then(() => getLineInput(`End of range:`))
        .then(rangeEnd => { newRange.end = rangeEnd; })
        .then(() => { config.dhcp.leases.pool.ranges.push(newRange); })
        .then(() => getLineInput(`Add another range to your address pool? [y/N]:`))
        .then(addMore => {
            if (!!addMore && (addMore.search(/^Y$/i) == 0))
                return dhcpRange();
        });
}

function dhcpSubnet() {
    return getLineInput(`What is the subnet mask for your network? [default: 255.255.255.0]:`)
        .then(networkMask => {
            config.dhcp.leases.pool.networkMask = networkMask || `255.255.255.0`;
        });
}

function dnsSuffix() {
    // eslint-disable-next-line no-console
    console.log(`Do you have a top-level-domain name to append to local devices?`);

    return getLineInput(`TLD (blank for none): `)
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

function getLineInput(questionText) {
    return new Promise(resolve => {
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        if (questionText.substr(questionText.length - 1) !== ` `)
            questionText += ` `;

        rl.question(questionText, (tld) => {
            rl.close();

            resolve(tld.trim());
        });
    });
}

module.exports.GenerateConfiguration = newConfiguration;
