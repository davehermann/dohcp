// Application modules
const { MessageByte } = require(`./messageByte`),
    { Answer } = require(`./answer`),
    { Question } = require(`./question`),
    { LogLevels, Dev, Trace, } = require(`../../logging`);

let _master = new WeakMap(),
    _questions = new WeakMap(),
    _answers = new WeakMap();

class DNSMessage {
    constructor() {
        _master.set(this, []);
        _questions.set(this, []);
        _answers.set(this, []);
    }

    get hexadecimal() { return _master.get(this).map(element => { return element.hexadecimal; }); }
    get binary() { return _master.get(this).map(element => { return element.binary; }); }

    // Header ---------------------------------------------------------------------------
    // Query ID is the first two entries
    get queryId() { return parseInt(this.hexadecimal.slice(0, 2).join(``), 16); }
    // Parameters - the next 16 bits (2 bytes) -------------------------------------
    get _parameters() { return this.binary.slice(2, 4).join(``); }
    // QR is the first bit on the parameters
    get qr() { return +this._parameters.substr(0, 1);}
    // Opcode is the next 4 bits
    get opcode() { return parseInt(this._parameters.substr(1, 4), 2); }
    // Authoritative Answer
    get aa() { return +this._parameters.substr(5, 1) === 1; }
    // Is answer truncated
    get tc() { return +this._parameters.substr(6, 1) === 1; }
    // Recursion Desired?
    get rd() { return +this._parameters.substr(7, 1) === 1; }
    // Recursion Available
    get ra() { return +this._parameters.substr(8, 1) === 1; }
    // Z (reserved for future use)
    get z() { return parseInt(this._parameters.substr(9, 3), 2); }
    // Response Code
    get rcode() { return parseInt(this._parameters.substr(12, 4), 2); }
    // End Parameters --------------------------------------------------------------
    // Number of Questions
    get qdcount() { return parseInt(this.hexadecimal.slice(4, 6).join(``), 16); }
    // Number of Answers
    get ancount() { return parseInt(this.hexadecimal.slice(6, 8).join(``), 16); }
    // Number of Authority Records
    get nscount() { return parseInt(this.hexadecimal.slice(8, 10).join(``), 16); }
    // Number of Additional Records
    get arcount() { return parseInt(this.hexadecimal.slice(10, 12).join(``), 16); }
    // End Header -----------------------------------------------------------------------

    // Questions ------------------------------------------------------------------------
    get questions() { return _questions.get(this); }
    // End Questions --------------------------------------------------------------------

    // Answers --------------------------------------------------------------------------
    get answers() { return _answers.get(this); }
    // End Answers ----------------------------------------------------------------------

    // As a DNS message
    get dnsMessage() { return Buffer.from(this.hexadecimal.join(``), `hex`); }

    FromDNS(msg) {
        // Generate a respresentation where each array index contains decimal, hex, and binary representations
        let messageMaster = [];
        for (let offset = 0; offset < msg.length; offset++)
            messageMaster.push(new MessageByte(msg.readUInt8(offset)));
        _master.set(this, messageMaster);

        // Parse questions
        let questions = [],
            offset = 12;
        for (let qIdx = 0; qIdx < this.qdcount; qIdx++) {
            let q = new Question();
            offset = q.DecodeFromDNS(messageMaster, offset);
            questions.push(q);
        }
        _questions.set(this, questions);

        // Parse answers
        this.hexadecimal.forEach((element, idx) => {
            Dev(`${idx.toString().padStart(3, `0`)}: ${element}`);
        });

        let answers = [];
        for (let aIdx = 0; aIdx < this.ancount; aIdx++) {
            let a = new Answer();
            offset = a.DecodeFromDNS(messageMaster, offset);

            Trace({ a });

            answers.push(a);
        }
        _answers.set(this, answers);
    }

    AddQuestions(questionLabelArray) {
        questionLabelArray.forEach(question => {
            let q = new Question();
            q.label = question;
            q.typeId = 1;
            q.classId = 1;
            _questions.get(this).push(q);
        });
    }

    AddAnswers(answerArray) {
        answerArray.forEach(answer => {
            _answers.get(this).push(answer);
        });
    }

    Generate(queryId, isReply, recursionDesired) {
        // Clear the master data
        let messageMaster = [];

        // Create a header
        if ((queryId === undefined) || (queryId === null))
            queryId = Math.round(Math.random() * 65000);

        this._writeHeader(messageMaster, queryId, isReply, recursionDesired);

        // Write the questions
        this.questions.forEach(q => { q.EncodeToDNS(messageMaster); });

        // Write the answers
        this.answers.forEach(a => { a.EncodeToDNS(messageMaster); });

        _master.set(this, messageMaster);
    }

    _writeHeader(messageMaster, queryId, isReply, recursionDesired) {
        // Query ID is 2 bytes
        Question.WriteBytes(messageMaster, 2, queryId);

        // Parameters section is 2 bytes, written as 16 bits
        let header = ``;
        // QR is 1 bit
        header += (isReply ? 1 : 0);
        // OPCODE is 4 bits
        header += `0000`;
        // AA is 1 bit
        header += `0`;
        // TC is 1 bit
        header += `0`;
        // RD is 1 bit, based on the desired for an answer
        header += (isReply ? (recursionDesired ? 1 : 0) : 1);
        // RA is 1 bit
        header += (isReply ? 1 : 0);
        // Z is 3 bits
        header += `000`;
        // RCODE is 4 bits
        header += `0000`;
        Question.WriteBytes(messageMaster, 2, header, `binary`);

        // Question count
        Question.WriteBytes(messageMaster, 2, this.questions.length);
        // Answer count
        Question.WriteBytes(messageMaster, 2, this.answers.length);
        // Authority records count
        Question.WriteBytes(messageMaster, 2, 0);
        // Additional records count
        Question.WriteBytes(messageMaster, 2, 0);
    }

    toJSON() {
        let data = {};
        if (global.logLevel == LogLevels.dev) {
            data.source = _master.get(this);
            data.hex = this.hexadecimal;
            data.bin = this.binary;
        }

        data.header = {
            queryId: this.queryId,
            parameters: {
                asBinary: this.binary.slice(2, 4).join(``),
                qr: this.qr,
                opcode: this.opcode,
                aa: this.aa,
                tc: this.tc,
                rd: this.rd,
                ra: this.ra,
                z: this.z,
                rcode: this.rcode,
            },
            qdcount: this.qdcount,
            ancount: this.ancount,
            nscount: this.nscount,
            arcount: this.arcount,
        };

        data.questions = this.questions;
        data.answers = this.answers;

        return data;
    }
}


module.exports.DNSMessage = DNSMessage;
