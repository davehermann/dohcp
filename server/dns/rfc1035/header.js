// Application modules
const { ReadString, ReadUInt16 } = require(`../../utilities`);

let _queryId = new WeakMap(),
    _queryParametersHex = new WeakMap(),
    _numberOfQuestions = new WeakMap(),
    _numberOfAnswers = new WeakMap(),
    _numberOfAuthorityRecords = new WeakMap(),
    _numberOfAdditionalRecords = new WeakMap();

class Header {
    constructor() {}

    get queryId() { return _queryId.get(this); }
    set queryId(val) { _queryId.set(this, val); }

    // Query Parameters
    get queryParametersHex() { return _queryParametersHex.get(this); }
    set queryParametersHex(val) { _queryParametersHex.set(this, val); }
    get queryParametersBinary() { return parseInt(this.queryParametersHex, 16).toString(2).padStart(this.queryParametersHex.length * 4, `0`); }

    // Query/Response [1 bit]
    get qr() { return +this.queryParametersBinary.substr(0, 1); }
    get isQuery() { return this.qr === 0; }
    get isResponse() { return this.qr === 1; }
    // Opcode [4 bits] (0 == standard, 1 == inverse, 2 == server status)
    get opcode() {
        let code = this.queryParametersBinary.substr(1, 4);
        return parseInt(code, 2);
    }
    // Authoritative answer [1 bit]
    get aa() { return +this.queryParametersBinary.substr(5, 1) === 1; }
    // Truncated [1 bit]
    get tc() { return +this.queryParametersBinary.substr(6, 1) === 1; }
    // Recursion Desired [1 bit]
    get rd() { return +this.queryParametersBinary.substr(7, 1) === 1; }
    // Recursion Available [1 bit]
    get ra() { return +this.queryParametersBinary.substr(8, 1) === 1; }
    // Z - reserved for future and must always be 0 [3 bits]
    get z() { return this.queryParametersBinary.substr(9, 3); }
    // Response code [4 bits] (0 == no error, 1 == format error, 2 == server failure, 3 == name error - on AA only, 4 == not implemented - by the server, 5 == refused to perform operation)
    get rcode() { return parseInt(this.queryParametersBinary.substr(12, 4), 2); }

    get numberOfQuestions() { return _numberOfQuestions.get(this); }
    set numberOfQuestions(val) { _numberOfQuestions.set(this, val); }
    get numberOfAnswers() { return _numberOfAnswers.get(this); }
    set numberOfAnswers(val) { _numberOfAnswers.set(this, val); }
    get numberOfAuthorityRecords() { return _numberOfAuthorityRecords.get(this); }
    set numberOfAuthorityRecords(val) { _numberOfAuthorityRecords.set(this, val); }
    get numberOfAdditionalRecords() { return _numberOfAdditionalRecords.get(this); }
    set numberOfAdditionalRecords(val) { _numberOfAdditionalRecords.set(this, val); }

    Decode(messageBuffer, offset = 0) {
        // Offset should be 0, but we'll define as a parameter to match the rest of the application

        ({ value: this.queryId, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.queryParametersHex, offset } = ReadString(messageBuffer, offset, 2, `hex`));
        ({ value: this.numberOfQuestions, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.numberOfAnswers, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.numberOfAuthorityRecords, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.numberOfAdditionalRecords, offset } = ReadUInt16(messageBuffer, offset));

        return offset;
    }

    toJSON() {
        return {
            queryId: this.queryId,
            queryParametersHex: this.queryParametersHex,
            queryParametersBinary: this.queryParametersBinary,
            qr: this.qr,
            opcode: this.opcode,
            aa: this.aa,
            tc: this.tc,
            rd: this.rd,
            ra: this.ra,
            z: this.z,
            rcode: this.rcode,
            numberOfQuestions: this.numberOfQuestions,
            numberOfAnswers: this.numberOfAnswers,
            numberOfAuthorityRecords: this.numberOfAuthorityRecords,
            numberOfAdditionalRecords: this.numberOfAdditionalRecords,
        };
    }
}

module.exports.Header = Header;
