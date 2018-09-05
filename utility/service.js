// Node/NPM modules
const fs = require(`fs`),
    readline = require(`readline`),
    path = require(`path`);

// Application modules
const { EnsurePathFor, RunCommand } = require(`./utilities`);

const SERVICE_UNIT = `dohcp.service`,
    GENERATED_UNIT = path.join(__dirname, `..`, `service`, SERVICE_UNIT),
    UNIT_LINK = `/${path.join(`etc`, `systemd`, `system`, SERVICE_UNIT)}`,
    UNIT_TEMPLATE = path.join(__dirname, `systemd-service-template`);

function installService(action) {
    let doNotStartEnable = (action.additionalArguments.indexOf(`--no-start`) >= 0);

    // eslint-disable-next-line no-console
    console.log(`Installing as a systemd unit`);

    // Check for Linux as the OS
    return checkLinuxOs()
        // Check for systemd
        .then(() => checkSystemd())
        // // Check for running as root/sudo
        .then(() => checkRoot())
        // Ask for the username for a user account that can run the service, and confirm it exists
        .then(() => getServiceAccountName())
        // Load the template file, and replace the username and the working directory in the template
        .then(userAccountName => loadTemplate(userAccountName))
        // Write the template to ./service/dohcp.service
        .then(serviceUnit => writeTemplateToLocalPath(serviceUnit))
        // Link to /etc/systemd/system
        .then(() => linkUnit())
        // Start/Enable the unit
        .then(() => startUnit(doNotStartEnable));
}

function checkLinuxOs() {
    if (process.platform == `linux`)
        return Promise.resolve();

    // eslint-disable-next-line no-console
    console.log(`This can only be installed on Linux. Platform: ${process.platform}`);
    return Promise.reject(new Error(`Linux not detected as the OS`));
}

function checkSystemd() {
    return new Promise((resolve, reject) => {
        fs.readlink(`/sbin/init`, (err, linkPath) => {
            if (!!err)
                reject(err);
            else {
                resolve(linkPath.search(/systemd/) >= 0);
            }
        });
    })
        .then(isSystemd => {
            if (isSystemd)
                return Promise.resolve();

            // eslint-disable-next-line no-console
            console.log(`This can only install a systemd unit.`);
            return Promise.reject(new Error(`Systemd not detected`));
        });
}

function checkRoot() {
    if ((process.getuid() !== 0))
        return Promise.resolve();

    // eslint-disable-next-line no-console
    console.log(`'install' and 'remove'should not be run via the root account, or elevated priviledges.\nYou will be asked for your 'sudo' password when needed.`);
    return Promise.reject(new Error(`Not running via root/sudo`));
}

function getServiceAccountName(foundAccount) {
    if (!!foundAccount)
        return Promise.resolve(foundAccount);

    if (foundAccount === null)
        // eslint-disable-next-line no-console
        console.log(`An account with that username was not found.\n`);

    return new Promise(resolve => {
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(`Provide a user account name to run the service: `, (accountName) => {
            rl.close();

            resolve(accountName.trim());
        });
    })
        .then(accountName => {
            // Confirm the account exists, or message that it doesn't and rerun
            return new Promise((resolve, reject) => {
                fs.readFile(`/etc/passwd`, { encoding: `utf8` }, (err, users) => {
                    if (!!err)
                        reject(err);
                    else
                        resolve(users.split(`\n`).filter(u => { return u.length > 0; }).map(u => { return u.split(`:`)[0]; }));
                });
            })
                .then(allUsers => { return (allUsers.indexOf(accountName) >= 0) ? accountName : null; });
        })
        .then(foundAccount => getServiceAccountName(foundAccount));
}

function loadTemplate(userAccountName) {
    return new Promise((resolve, reject) => {
        fs.readFile(UNIT_TEMPLATE, { encoding: `utf8` }, (err, template) => {
            if (!!err)
                reject(err);
            else
                resolve(template);
        });
    })
        .then(template => {
            template = template.replace(/\{username\}/g, userAccountName).replace(/\{workingDirectory\}/g, path.join(__dirname, `..`));
            return Promise.resolve(template);
        });
}

function writeTemplateToLocalPath(serviceUnit) {
    return EnsurePathFor(GENERATED_UNIT)
        .then(() => {
            // Write the file
            return new Promise((resolve, reject) => {
                fs.writeFile(GENERATED_UNIT, serviceUnit, { encoding: `utf8` }, (err) => {
                    if (!!err)
                        reject(err);
                    else
                        resolve();
                });
            });
        })
        // eslint-disable-next-line no-console
        .then(() => { console.log(`\nA unit file has been generated at '${GENERATED_UNIT}'`); });
}

function linkUnit() {
    // Check for the link, and remove if found
    return new Promise((resolve, reject) => {
        fs.stat(UNIT_LINK, (err) => {
            if (!!err) {
                if (err.code == `ENOENT`)
                    resolve(false);
                else
                    reject(err);
            } else
                resolve(true);
        });
    })
        .then(linkExists => {
            let pRemove = Promise.resolve();

            if (linkExists)
                pRemove = RunCommand(`sudo`, `rm`, UNIT_LINK);

            return pRemove;
        })
        .then(() => {
            return RunCommand(`sudo`, `ln`, `-s`, GENERATED_UNIT, UNIT_LINK);
        })
        // eslint-disable-next-line no-console
        .then(() => { console.log(`\nThe unit file has been symlinked to '${UNIT_LINK}'\n`); });
}

function startUnit(doNotStartEnable) {
    if (doNotStartEnable) {
        // eslint-disable-next-line no-console
        console.log(`\ndohcp has been configured as a service; however, the systemd unit has not had start or enable run.\n\nPlease start/enable when you are ready to use.`);

        return Promise.resolve();
    }

    return RunCommand(`sudo`, `systemctl`, `enable`, SERVICE_UNIT)
        .then(() => RunCommand(`sudo`, `systemctl`, `start`, SERVICE_UNIT))
        .then(() => {
            // eslint-disable-next-line no-console
            console.log(`\ndohcp service has been started, and configured to launch at boot.`);
        });
}

function removeService() {
    // eslint-disable-next-line no-console
    console.log(`Removing the systemd unit`);

    // Check for Linux as the OS
    return checkLinuxOs()
        // Check for systemd
        .then(() => checkSystemd())
        // // Check for running as root/sudo
        .then(() => checkRoot())
        // Stop the unit and disable launch at boot
        .then(() => stopUnit())
        // Remove the symlink from systemd
        .then(() => unlinkUnit());
}

function stopUnit() {
    return RunCommand(`sudo`, `systemctl`, `stop`, SERVICE_UNIT)
        .then(() => RunCommand(`sudo`, `systemctl`, `disable`, SERVICE_UNIT));
}

function unlinkUnit() {
    return RunCommand(`sudo`, `rm`, UNIT_LINK);
}

module.exports.InstallService = installService;
module.exports.RemoveService = removeService;
