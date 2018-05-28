// Write the log entry
// data - the log data to write
// asIs - A javascript object will default to JSON output. Passing in `true` will force writing of the native object
function writeLog(data, asIs) {
    // eslint-disable-next-line no-console
    console.log((asIs || (typeof data !== `object`) ? data : JSON.stringify(data, null, 4)));
}

// Trace-level
function trace(data, asIs) {
    writeLog(data, asIs);
}

module.exports.Trace = trace;
