// Log levels
const levels = {
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
function writeLog(logLevelId, data, asIs) {
    let logLevel = levels[logLevelId];

    if (global.logLevel <= logLevel)
        // eslint-disable-next-line no-console
        console[logLevel < levels.error ? `log` : `error`]((asIs || (typeof data !== `object`) ? data : JSON.stringify(data, null, 4)));
}

// Trace-level
function trace(data, asIs) { writeLog(`trace`, data, asIs); }

// Debug-level
function debug(data, asIs) { writeLog(`debug`, data, asIs); }

// Info-level
function info(data, asIs) { writeLog(`info`, data, asIs); }

// Error-level
function err(data, asIs) { writeLog(`error`, data, asIs); }

module.exports.LogLevels = levels;
module.exports.Trace = trace;
module.exports.Debug = debug;
module.exports.Info = info;
module.exports.Error = err;
