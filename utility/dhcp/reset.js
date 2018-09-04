// Node/NPM modules
const fs = require(`fs`),
    path = require(`path`);

const statusFile = path.join(__dirname, `..`, `status`, `dhcp.json`);

function resetData(action) {
    // See if ~/status/dhcp.json exists
    return findStatus()
        .catch(err => {
            if (err.code == `ENOENT`) {
                // eslint-disable-next-line no-console
                console.log(`DHCP status file not found`);
                return true;
            } else
                return Promise.reject(err);
        })
        .then(noFile => {
            if (noFile)
                return Promise.resolve();

            // If the entire file is being reset, just delete it
            if (action.additionalArguments.indexOf(`--all`) >= 0) {
                // eslint-disable-next-line no-console
                console.log(`Clearing all DHCP history`);
                return removeFile();
            } else {
                // Otherwise, read the file, and reset all .byIP properties to null
                // eslint-disable-next-line no-console
                console.log(`Clearing DHCP usable address space history`);
                return readExisting();
            }
        })
        .then(fileData => clearIPs(fileData))
        .then(fileData => writeFile(fileData));

    // Load the DHCP status JSON, if it exists
}

function findStatus() {
    return new Promise((resolve, reject) => {
        fs.stat(statusFile, (err) => {
            if (!!err)
                reject(err);
            else
                resolve();
        });
    });
}

function readExisting() {
    return new Promise((resolve, reject) => {
        fs.readFile(statusFile, { encoding: `utf8`}, (err, contents) => {
            if (!!err)
                reject(err);
            else
                resolve(JSON.parse(contents));
        });
    });
}

function clearIPs(fileData) {
    if (!fileData)
        return null;

    for (let ipAddress in fileData.byIp)
        fileData.byIp[ipAddress] = null;

    return fileData;
}

function writeFile(fileData) {
    if (!fileData)
        return null;

    return new Promise((resolve, reject) => {
        fs.writeFile(statusFile, JSON.stringify(fileData, null, 4), { encoding: `utf8` }, (err) => {
            if (!!err)
                reject(err);
            else
                resolve();
        });
    });
}

function removeFile() {
    return new Promise((resolve, reject) => {
        fs.unlink(statusFile, (err) => {
            if (!!err)
                reject(err);
            else
                resolve();
        });
    });
}

module.exports.ResetDHCP = resetData;
