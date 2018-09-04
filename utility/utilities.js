// Node/NPM modules
const fs = require(`fs`),
    path = require(`path`),
    { spawn } = require(`child_process`);

// To include the OPTIONS object, it must be the first argument
function runCommand() {
    // Create an arguments array for manipulation
    let args = [], options;
    for (let idx = 0, total = arguments.length; idx < total; idx++)
        args.push(arguments[idx]);

    // Allow for options as the first argument
    if (typeof args[0] == `object`)
        options = args.shift();

    return new Promise((resolve, reject) => {
        if (args.length < 2)
            args.push(``);

        let command = spawn(args[0], args.slice(1), options),
            err = ``;

        command.stderr.on(`data`, (data) => {
            err += data;
        });

        command.on(`close`, (exitCode) => {
            // eslint-disable-next-line no-console
            console.log(`Closing`);
            if (err.length > 0)
                reject(err);
            else
                resolve(exitCode);
        });
    });
}

function ensurePath(fullPathWithFile) {
    let pathParts = path.dirname(fullPathWithFile).split(path.sep);

    return createMissingDirectories(pathParts);
}

function createMissingDirectories(pathParts, confirmedRoot) {
    if (pathParts.length > 0) {
        if (confirmedRoot === undefined)
            confirmedRoot = path.sep;

        let checkPath = path.join(confirmedRoot, pathParts.shift());

        return new Promise((resolve, reject) => {
            // Check for the directory
            fs.stat(checkPath, (err) => {
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
                        fs.mkdir(checkPath, (err) => {
                            if (!!err)
                                reject(err);
                            else
                                resolve();
                        });
                    });

                return pCreateDirectory;
            })
            .then(() => createMissingDirectories(pathParts, checkPath));
    } else
        return Promise.resolve();
}

function loadFile(relativePathToFile, options = { encoding: `utf8` }) {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(__dirname, `..`, relativePathToFile), options, (err, contents) => {
            if (!!err)
                reject(err);
            else
                resolve(contents);
        });
    });
}

module.exports.RunCommand = runCommand;
module.exports.EnsurePathFor = ensurePath;
module.exports.LoadFile = loadFile;
