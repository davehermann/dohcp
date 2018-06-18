// Application modules
const { QueryParameters } = require(`./queryParameters`),
    { ReadString, ReadUInt16 } = require(`../../utilities`);

let _queryId = new WeakMap(),
    _queryParameters = new WeakMap(),
    _numberOfQuestions = new WeakMap(),
    _numberOfAnswers = new WeakMap(),
    _numberOfAuthorityRecords = new WeakMap(),
    _numberOfAdditionalRecords = new WeakMap();

class Header {
    constructor(messageBuffer) {
        // Decode from the buffer
        if (!!messageBuffer)
            this.Decode(messageBuffer);
        else
            _queryParameters.set(this, new QueryParameters());
    }

    get queryId() { return _queryId.get(this); }
    set queryId(val) { _queryId.set(this, val); }
    get id() { return this.queryId.toString(16).padStart(4, `0`); }

    // Query Parameters
    set queryParametersHex(val) { _queryParameters.set(this, new QueryParameters(val)); }
    get queryParameters() { return _queryParameters.get(this); }
    get queryParameters_hex() { return this.queryParameters.toHex(); }
    set isQuery(val) { this.queryParameters.isQuery = val; }
    set recursionDesired(val) { this.queryParameters.isRecursionDesired = val; }

    get numberOfQuestions() { return _numberOfQuestions.get(this); }
    set numberOfQuestions(val) { _numberOfQuestions.set(this, val); }
    get qdcount() { return this.numberOfQuestions.toString(16).padStart(4, `0`); }

    get numberOfAnswers() { return _numberOfAnswers.get(this); }
    set numberOfAnswers(val) { _numberOfAnswers.set(this, val); }
    get ancount() { return this.numberOfAnswers.toString(16).padStart(4, `0`); }

    get numberOfAuthorityRecords() { return _numberOfAuthorityRecords.get(this); }
    set numberOfAuthorityRecords(val) { _numberOfAuthorityRecords.set(this, val); }
    get nscount() { return this.numberOfAuthorityRecords.toString(16).padStart(4, `0`); }

    get numberOfAdditionalRecords() { return _numberOfAdditionalRecords.get(this); }
    set numberOfAdditionalRecords(val) { _numberOfAdditionalRecords.set(this, val); }
    get arcount() { return this.numberOfAdditionalRecords.toString(16).padStart(4, `0`); }

    get length() { return this.toHex().length / 2; }

    Decode(messageBuffer) {
        let offset = 0;

        ({ value: this.queryId, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.queryParametersHex, offset } = ReadString(messageBuffer, offset, 2, `hex`));
        ({ value: this.numberOfQuestions, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.numberOfAnswers, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.numberOfAuthorityRecords, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.numberOfAdditionalRecords, offset } = ReadUInt16(messageBuffer, offset));
    }

    GenerateHeader(message, dnsQuery) {
        this.numberOfQuestions = message.questions.length;
        this.numberOfAnswers = message.answers.length;
        this.numberOfAuthorityRecords = 0;
        this.numberOfAdditionalRecords = 0;

        if (!!dnsQuery && dnsQuery.header.queryParameters.isRecursionDesired)
            this.queryParameters.isRecursionDesired = true;
    }

    toHex() {
        return `${this.id}${this.queryParameters_hex}${this.qdcount}${this.ancount}${this.nscount}${this.arcount}`;
    }

    toJSON() {
        return {
            id: this.queryId,
            parameters: this.queryParameters,
            numberOfQuestions: this.numberOfQuestions,
            numberOfAnswers: this.numberOfAnswers,
            numberOfAuthorityRecords: this.numberOfAuthorityRecords,
            numberOfAdditionalRecords: this.numberOfAdditionalRecords,
        };
    }
}

module.exports.Header = Header;
