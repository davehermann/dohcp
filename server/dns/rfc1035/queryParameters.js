let opCodes = {
    standard: 0,
    inverse: 1,
    status: 2,
};

let responseCode = {
    0: `No Error`,
    1: `Format Error`,
    2: `Server Failure`,
    3: `Name Error (Authoritative answers only)`,
    4: `Type not implemented`,
    5: `Refused operation`,
};

let _isQuery = new WeakMap(),
    _operationCode = new WeakMap(),
    _authoritativeAnswer = new WeakMap(),
    _truncated = new WeakMap(),
    _recursionDesired = new WeakMap(),
    _recursionAvailable = new WeakMap(),
    _zFutureUse = new WeakMap(),
    _responseCode = new WeakMap();

class QueryParameters {
    constructor(asHexadecimal) {
        this.Decode(asHexadecimal);
    }

    // QR (Query/Response) [1 bit]
    get isQuery() { return _isQuery.get(this); }
    get isResponse() { return !this.isQuery; }
    get qr() { return this.isQuery ? 0 : 1; }

    // Opcode [4 bits] (0 == standard, 1 == inverse, 2 == server status)
    get operationCode() { return _operationCode.get(this); }
    get opCode() { return this.operationCode.toString(2).padStart(4, `0`); }

    // Authoritative answer [1 bit]
    get authoritativeAnswer() { return _authoritativeAnswer.get(this); }
    get aa() { return !this.authoritativeAnswer ? 0 : 1; }
    // Truncated [1 bit]
    get isTruncated() { return _truncated.get(this); }
    get tc() { return !this.isTruncated ? 0 : 1; }
    // Recursion Desired [1 bit]
    get isRecursionDesired() { return _recursionDesired.get(this); }
    get rd() { return !this.isRecursionDesired ? 0 : 1; }
    // Recursion Available [1 bit]
    get isRecursionAvailable() { return _recursionAvailable.get(this); }
    get ra() { return !this.isRecursionAvailable ? 0 : 1; }
    // Z - reserved for future and must always be 0 [3 bits]
    get zIgnored() { return _zFutureUse.get(this); }
    get z() { return this.zIgnored.toString(2).padStart(3, `0`); }
    // Response code [4 bits] (0 == no error, 1 == format error, 2 == server failure, 3 == name error - on AA only, 4 == not implemented - by the server, 5 == refused to perform operation)
    get responseCode() { return _responseCode.get(this); }
    get rCode() { return this.responseCode.toString(2).padStart(4, `0`); }

    Decode(parametersHex) {
        // Convert to binary representation
        let parametersBinary = parseInt(parametersHex, 16).toString(2).padStart(parametersHex.length * 4, `0`);

        _isQuery.set(this, (+parametersBinary.substr(0, 1) === 0));
        _operationCode.set(this, parseInt(parametersBinary.substr(1, 4), 2));
        _authoritativeAnswer.set(this, +parametersBinary.substr(5, 1) === 1);
        _truncated.set(this, +parametersBinary.substr(6, 1) === 1);
        _recursionDesired.set(this, +parametersBinary.substr(7, 1) === 1);
        _recursionAvailable.set(this, +parametersBinary.substr(8, 1) === 1);
        _zFutureUse.set(this, parseInt(parametersBinary.substr(9, 3), 2));
        _responseCode.set(this, parseInt(parametersBinary.substr(12, 4), 2));
    }

    toBinary() {
        // Create a binary version of the data
        return `${this.qr}${this.opCode}${this.aa}${this.tc}${this.rd}${this.ra}${this.z}${this.rCode}`;
    }

    toHex() {
        // Convert to Hexadecimal one hex digit at a time
        return parseInt(this.toBinary(), 2).toString(16).padStart(4, `0`);
    }

    toJSON() {
        return {
            asBinary: this.toBinary(),
            asHex: this.toHex(),
            isQuery: this.isQuery,
            opcode: this.operationCode,
            aa: this.authoritativeAnswer,
            tc: this.isTruncated,
            rd: this.isRecursionDesired,
            ra: this.isRecursionAvailable,
            z: this.zIgnored,
            rcode: this.responseCode,
        };
    }
}

module.exports.QueryParameters = QueryParameters;
