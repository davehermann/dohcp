const fs = require(`fs`),
    readline = require(`readline`),
    path = require(`path`),
    { spawn } = require(`child_process`);

const SERVICE_UNIT = `dohcp.service`,
    GENERATED_UNIT = path.join(process.cwd(), `service`, SERVICE_UNIT),
    UNIT_LINK = `/${path.join(`etc`, `systemd`, `system`, SERVICE_UNIT)}`,
    UNIT_TEMPLATE = path.join(process.cwd(), `utility`, `systemd-service-template`);

function installService() {
    let pInstall = Promise.resolve();

    // eslint-disable-next-line no-console
    console.log(`Installing as a systemd unit`);

    // Check for Linux as the OS
    pInstall = checkLinuxOs()
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
        .then(() => startUnit());

    return pInstall;
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
            template = template.replace(/\{username\}/g, userAccountName).replace(/\{workingDirectory\}/g, process.cwd());
            return Promise.resolve(template);
        });
}

function writeTemplateToLocalPath(serviceUnit) {
    // Add a path for ./service if it doesn't exist
    return new Promise((resolve, reject) => {
        // Check for the directory
        fs.stat(path.dirname(GENERATED_UNIT), (err) => {
            if (!!err) {
                if (err.code == `ENOENT`)
                    resolve(false);
                else
                    reject(err);
            } else
                resolve(true);
        });
    })
        .then(directoryExists => {
            let pCreateDirectory = Promise.resolve();

            if (!directoryExists)
                pCreateDirectory = new Promise((resolve, reject) => {
                    fs.mkdir(path.dirname(GENERATED_UNIT), (err) => {
                        if (!!err)
                            reject(err);
                        else
                            resolve();
                    });
                });

            return pCreateDirectory;
        })
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
        });
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
                pRemove = runCommand(`sudo`, `rm`, UNIT_LINK);

            return pRemove;
        })
        .then(() => {
            return runCommand(`sudo`, `ln`, `-s`, GENERATED_UNIT, UNIT_LINK);
        });
}

function startUnit() {
    return runCommand(`sudo`, `systemctl`, `enable`, SERVICE_UNIT)
        .then(() => runCommand(`sudo`, `systemctl`, `start`, SERVICE_UNIT))
        .then(() => {
            // eslint-disable-next-line no-console
            console.log(`\ndohcp service has been started, and configured to launch at boot.`);
        });
}

function runCommand() {
    // Create an arguments array for manipulation
    let args = [];
    for (let idx = 0, total = arguments.length; idx < total; idx++)
        args.push(arguments[idx]);

    return new Promise((resolve, reject) => {
        if (args.length < 2)
            args.push(``);

        let command = spawn(args[0], args.slice(1)),
            err = ``;

        command.stderr.on(`data`, (data) => {
            err += data;
        });

        command.on(`close`, (exitCode) => {
            if (err.length > 0)
                reject(err);
            else
                resolve(exitCode);
        });
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
    return runCommand(`sudo`, `systemctl`, `stop`, SERVICE_UNIT)
        .then(() => runCommand(`sudo`, `systemctl`, `disable`, SERVICE_UNIT));
}

function unlinkUnit() {
    return runCommand(`sudo`, `rm`, UNIT_LINK);
}

module.exports.InstallService = installService;
module.exports.RemoveService = removeService;