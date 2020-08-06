// NPM Modules
import { Dev, Trace, GetConfiguredLogging, LogLevels } from "multi-level-logger";

// Application Modules
import { Answer } from "./answer";
import { MessageByte, WriteBytes } from "./MessageByte";
import { Question } from "./question";
import { eDnsType, eDnsClass, eMessageByteComponent } from "../../../interfaces/configuration/dns";

class DnsMessage {
    constructor() {
        this._answers = [];
        this._master = [];
        this._questions = [];
    }

    /** List of answers present in message */
    private _answers: Array<Answer>;
    /** Message represented as array of bytes in different numerical bases */
    private _master: Array<MessageByte>;
    /** List of questions present in the message */
    private _questions: Array<Question>;

    /** Hexadecimal representation of the message array */
    get hexadecimal(): Array<string> { return this._master.map(element => element.hexadecimal); }
    /** Binary representation of the message array */
    get binary(): Array<string> { return this._master.map(element => element.binary ); }

    /** Number of Answers in message */
    get ancount(): number { return parseInt(this.hexadecimal.slice(6, 8).join(``), 16); }
    /** Number of questions in message */
    get qdcount(): number { return parseInt(this.hexadecimal.slice(4, 6).join(``), 16); }

    // Header ---------------------------------------------------------------------------
    /** Query ID is the first two bytes of the message */
    get queryId(): number { return parseInt(this.hexadecimal.slice(0, 2).join(``), 16); }
    // Parameters - the next 16 bits (2 bytes) -------------------------------------
    get _parameters(): string { return this.binary.slice(2, 4).join(``); }
    // // QR is the first bit on the parameters
    // get qr() { return +this._parameters.substr(0, 1);}
    // // Opcode is the next 4 bits
    // get opcode() { return parseInt(this._parameters.substr(1, 4), 2); }
    // // Authoritative Answer
    // get aa() { return +this._parameters.substr(5, 1) === 1; }
    // // Is answer truncated
    // get tc() { return +this._parameters.substr(6, 1) === 1; }
    // Recursion Desired?
    get rd(): boolean { return +this._parameters.substr(7, 1) === 1; }
    // // Recursion Available
    // get ra() { return +this._parameters.substr(8, 1) === 1; }
    // // Z (reserved for future use)
    // get z() { return parseInt(this._parameters.substr(9, 3), 2); }
    // // Response Code
    // get rcode() { return parseInt(this._parameters.substr(12, 4), 2); }
    // // End Parameters --------------------------------------------------------------
    // // Number of Questions
    // get qdcount() { return parseInt(this.hexadecimal.slice(4, 6).join(``), 16); }
    // // Number of Answers
    // get ancount() { return parseInt(this.hexadecimal.slice(6, 8).join(``), 16); }
    /** Number of Authority Records */
    get nscount(): number { return parseInt(this.hexadecimal.slice(8, 10).join(``), 16); }
    // // Number of Additional Records
    // get arcount() { return parseInt(this.hexadecimal.slice(10, 12).join(``), 16); }
    // End Header -----------------------------------------------------------------------


    // Questions ------------------------------------------------------------------------
    /** Get the read-only questions list from this DNS message */
    get questions(): Array<Question> { return this._questions; }
    // End Questions --------------------------------------------------------------------

    // Answers ------------------------------------------------------------------------
    /** Get the read-only answers list from this DNS message */
    get answers(): Array<Answer> { return this._answers; }
    // End Answers --------------------------------------------------------------------

    /** Get this message as a DNS binary Buffer */
    get dnsMessage(): Buffer { return Buffer.from(this.hexadecimal.join(``), `hex`); }

    /**
     * Convert message into a MessageByte array
     * @param msg - Raw DNS binary message
     */
    private mapMessage(msg: Buffer): void {
        // Generate a respresentation where each array index contains decimal, hex, and binary representations
        const messageMaster: Array<MessageByte> = [];
        for (let offset = 0; offset < msg.length; offset++)
            messageMaster.push(new MessageByte(msg.readUInt8(offset)));
        this._master = messageMaster;
    }

    /** Parse question section from the DNS message */
    private parseQuestions(): number {
        const questions: Array<Question> = [];
        let offset = 12;
        for (let qIdx = 0; qIdx < this.qdcount; qIdx++) {
            const q = new Question();
            offset = q.DecodeFromDNS(this._master, offset);
            questions.push(q);
        }

        this._questions = questions;

        return offset;
    }

    /** Parse answers section from the DNS message */
    private parseAnswers(offset: number): number {
        this.hexadecimal.forEach((element, idx) => {
            Dev(`${idx.toString().padStart(3, `0`)}: ${element}`, { logName: `dns` });
        });

        const answers: Array<Answer> = [];
        for (let aIdx = 0; aIdx < this.ancount; aIdx++) {
            const a = new Answer();
            offset = a.DecodeFromDNS(this._master, offset);

            Trace({ a }, { logName: `dns` });

            answers.push(a);
        }

        this._answers = answers;

        return offset;
    }

    /**
     * Write the DNS message header to the message
     * @param message
     * @param queryId
     * @param isReply
     * @param recursionDesired
     */
    private writeHeader(queryId: number, isReply: boolean, recursionDesired: boolean) {
        // Query ID is 2 bytes
        WriteBytes(this._master, 2, queryId);

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
        // RD is 1 bit, based on the desire for an answer
        header += (isReply ? (recursionDesired ? 1 : 0) : 1);
        // RA is 1 bit
        header += (isReply ? 1 : 0);
        // Z is 3 bits
        header += `000`;
        // RCODE is 4 bits
        header += `0000`;
        WriteBytes(this._master, 2, header, eMessageByteComponent.binary);

        // Question count
        WriteBytes(this._master, 2, this.questions.length);
        // Answer count
        WriteBytes(this._master, 2, this.answers.length);
        // Authority records count
        WriteBytes(this._master, 2, 0);
        // Additional records count
        WriteBytes(this._master, 2, 0);
    }

    /**
     * Parse a DNS message
     * @param msg - Raw DNS binary message
     */
    FromDNS(msg: Buffer): void {
        let offset: number;

        this.mapMessage(msg);

        offset = this.parseQuestions();

        offset = this.parseAnswers(offset);
    }

    /**
     * Add list of answers to this DNS message
     * @param answers - Array of answers to add
     */
    AddAnswers(answers: Array<Answer>): void {
        this._answers = this._answers.concat(answers);
    }

    /**
     * Add domain names to message for querying
     * @param domainNames - List of domain names to query
     */
    AddQuestions(domainNames: Array<string>): void {
        domainNames.forEach(domainName => {
            const question = new Question();
            question.label = domainName;
            question.typeId = eDnsType.A;
            question.classId = eDnsClass.IN;

            this._questions.push(question);
        });
    }

    Generate(queryId?: number, isReply?: boolean, recursionDesired?: boolean): void {
        // Clear this message
        this._master = [];

        // Generate a query ID if needed
        queryId = queryId ?? Math.round(Math.random() * 65000);

        // Create a header
        this.writeHeader(queryId, isReply, recursionDesired);

        // Write the questions
        this.questions.forEach(question => question.EncodeToDNS(this._master));

        // Write the answers
        this.answers.forEach(answer => answer.EncodeToDNS(this._master));
    }

    /** Use for logging */
    toJSON(): any {
        const data = { source: null, hex: null, bin: null, header: null, questions: null, answers: null };

        const { logLevel } = GetConfiguredLogging();
        if (logLevel.dns == LogLevels.dev) {
            data.source = this._master;
            data.hex = this.hexadecimal;
            data.bin = this.binary;
        }

        data.header = {
            queryId: this.queryId,
            parameters: {
                asBinary: this.binary.slice(2, 4).join(``),
                // qr: this.qr,
                // opcode: this.opcode,
                // aa: this.aa,
                // tc: this.tc,
                // rd: this.rd,
                // ra: this.ra,
                // z: this.z,
                // rcode: this.rcode,
            },
            qdcount: this.qdcount,
            ancount: this.ancount,
            nscount: this.nscount,
            // arcount: this.arcount,
        };

        data.questions = this.questions;
        data.answers = this.answers;

        return data;
    }
}

export {
    DnsMessage as DNSMessage,
};
