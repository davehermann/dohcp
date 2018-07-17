// Log levels
const levels = {
    dev: 0,
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
};

// Write the log entry
// data - the log data to write
// asIs - A javascript object will default to JSON output. Passing in `true` will force writing of the native object
function writeLog(logLevelId, data, asIs, logName) {
    let logLevel = levels[logLevelId];

    if (typeof asIs == `string`) {
        logName = asIs;
        asIs = undefined;
    }

    if (!logName)
        logName = `default`;

    if (global.logLevel[logName] <= logLevel)
        // eslint-disable-next-line no-console
        console[logLevel < levels.error ? `log` : `error`]((asIs || (typeof data !== `object`) ? data : JSON.stringify(data, null, 4)));
}

// Development-only level (Not recommended)
function dev(data, asIs, logName) { writeLog(`dev`, data, asIs, logName); }

// Trace-level
function trace(data, asIs, logName) { writeLog(`trace`, data, asIs, logName); }

// Debug-level
function debug(data, asIs, logName) { writeLog(`debug`, data, asIs, logName); }

// Info-level
function info(data, asIs, logName) { writeLog(`info`, data, asIs, logName); }

// Warn level
function warn(data, asIs, logName) { writeLog(`warn`, data, asIs, logName); }

// Error-level
function err(data, asIs, logName) { writeLog(`error`, data, asIs, logName); }

module.exports.LogLevels = levels;
module.exports.Dev = dev;
module.exports.Trace = trace;
module.exports.Debug = debug;
module.exports.Info = info;
module.exports.Warn = warn;
module.exports.Err = err;
