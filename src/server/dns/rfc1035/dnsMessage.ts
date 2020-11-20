// NPM Modules
import { Dev, Trace, GetConfiguredLogging, LogLevels } from "multi-level-logger";

// Application Modules
import { Answer } from "./answer";
import { MessageByte, WriteBytes } from "./MessageByte";
import { Question } from "./question";
import { eDnsType, eDnsClass, eMessageByteComponent } from "../../../interfaces/configuration/dns";
import { ReadUInt16, ConvertTypeArrayToNumberArray, WriteUInt16, BinaryToNumberArray, ToHexadecimal } from "../../utilities";

interface IDnsMessageAsJson {
    source?: string;
    sourceAsHex?: string;
    header: IDnsHeaderAsJson;
    questions: Array<Question>;
    answers: Array<Answer>;
}

interface IDnsHeaderAsJson {
    queryId: number;
    parameters: IDnsHeaderParametersAsJson;
    qdcount: number;
    ancount: number;
    nscount: number;
}

interface IDnsHeaderParametersAsJson {
    asBinary: string;
    qr: number;
    opcode: number;
    aa: boolean;
    tc: boolean;
    rd: boolean;
    ra: boolean;
    z: number;
    rcode: number;
}

class DnsMessage {
    constructor() {
        this._answers = [];
        // this._master = [];
        this._questions = [];
    }

    /**
     * The DNS message as a numerical array
     *
     * @remarks
     * Instantiated to 10 zeros to handle class accessors that depend on it
     */
    private _message: Array<number> = new Array(10).fill(0);

    /** List of answers present in message */
    private _answers: Array<Answer>;
    // /** Message represented as array of bytes in different numerical bases */
    // private _master: Array<MessageByte>;
    /** List of questions present in the message */
    private _questions: Array<Question>;

    /** Hexadecimal representation of the message array */
    get hexadecimal(): Array<string> { return ToHexadecimal(Uint8Array.from(this._message)); }
    /** Binary representation of the message array */
    get binary(): Array<string> { return this._message.map(byteValue => byteValue.toString(2).padStart(8, `0`)); }

    //#region Header

    /** Query ID is the first two bytes of the message */
    get queryId(): number { return ReadUInt16(this._message, 0).value; }

    //#region Parameters - the next 16 bits (2 bytes)
    /** The 16 bytes following the 2-byte ID at the start of the message */
    get _parameters(): string { return ReadUInt16(this._message, 2).value.toString(2).padStart(16, `0`); }
    /** The first bit on the parameters */
    get qr(): number { return +this._parameters.substr(0, 1);}
    /** Bits 2 - 5 on the parameters */
    get opcode(): number { return parseInt(this._parameters.substr(1, 4), 2); }
    /** Is this an Authoritative Answer */
    get aa(): boolean { return +this._parameters.substr(5, 1) === 1; }
    /** Is answer truncated */
    get tc(): boolean { return +this._parameters.substr(6, 1) === 1; }
    /** Is Recursion Desired? */
    get rd(): boolean { return +this._parameters.substr(7, 1) === 1; }
    /** Is Recursion Available */
    get ra(): boolean { return +this._parameters.substr(8, 1) === 1; }
    /** Z (reserved for future use) */
    get z(): number { return parseInt(this._parameters.substr(9, 3), 2); }
    /** Response Code */
    get rcode(): number { return parseInt(this._parameters.substr(12, 4), 2); }
    //#endregion Parameters

    /** Number of Answers in message */
    get ancount(): number { return ReadUInt16(this._message, 6).value; }
    /** Number of questions in message */
    get qdcount(): number { return ReadUInt16(this._message, 4).value; }
    /** Number of Authority Records */
    get nscount(): number { return ReadUInt16(this._message, 8).value; }
    /** Number of Additional Records */
    get arcount(): number { return ReadUInt16(this._message, 10).value; }

    //#endregion Header


    // Questions ------------------------------------------------------------------------
    /** Get the read-only questions list from this DNS message */
    get questions(): Array<Question> { return this._questions; }
    // End Questions --------------------------------------------------------------------

    // Answers ------------------------------------------------------------------------
    /** Get the read-only answers list from this DNS message */
    get answers(): Array<Answer> { return this._answers; }
    // End Answers --------------------------------------------------------------------

    /** Get this message in DNS wire format */
    get dnsMessage(): Uint8Array { return new Uint8Array(this._message); }

    // /**
    //  * Convert message into a MessageByte array
    //  * @param msg - Raw DNS binary message
    //  */
    // private mapMessage(msg: Uint8Array): void {
    //     // Generate a respresentation where each array index contains decimal, hex, and binary representations
    //     const messageMaster: Array<MessageByte> = [];
    //     for (let offset = 0; offset < msg.length; offset++)
    //         messageMaster.push(new MessageByte(msg[offset]));
    //     this._master = messageMaster;
    // }

    /** Parse question section from the DNS message */
    private parseQuestions(): number {
        const questions: Array<Question> = [];

        // Starting offset for a DNS question is 12
        let offset = 12;

        for (let qIdx = 0; qIdx < this.qdcount; qIdx++) {
            const q = new Question();
            offset = q.DecodeFromDNS(this._message, offset);
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
            offset = a.DecodeFromDNS(this._message, offset);

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
        WriteUInt16(this._message, queryId);

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
        BinaryToNumberArray(header, 2).forEach(byteValue => this._message.push(byteValue));

        // Question count
        WriteUInt16(this._message, this.questions.length);
        // Answer count
        WriteUInt16(this._message, this.answers.length);
        // Authority records count
        WriteUInt16(this._message, 0);
        // Additional records count
        WriteUInt16(this._message, 0);
    }

    /**
     * Parse a DNS message
     * @param msg - Raw DNS binary message
     */
    FromDNS(msg: Uint8Array): void {
        this._message = ConvertTypeArrayToNumberArray(msg);

        // this.mapMessage(msg);

        const offset = this.parseQuestions();

        this.parseAnswers(offset);
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

    /** Generate a DNS wire format message from the existing data on this object */
    Generate(queryId?: number, isReply?: boolean, recursionDesired?: boolean): void {
        // Clear this message
        this._message = [];

        // Generate a query ID if needed
        queryId = queryId ?? Math.round(Math.random() * 65000);

        // Create a header
        this.writeHeader(queryId, isReply, recursionDesired);

        // Write the questions
        this.questions.forEach(question => question.EncodeToDNS(this._message));

        // Write the answers
        this.answers.forEach(answer => answer.EncodeToDNS(this._message));
    }

    /** Use for logging */
    toJSON(): IDnsMessageAsJson {
        const data: IDnsMessageAsJson = { header: null, questions: null, answers: null };

        const { logLevel } = GetConfiguredLogging();
        if (((logLevel.dns === undefined) && (logLevel.default == LogLevels.dev)) || (logLevel.dns == LogLevels.dev)) {
            data.source = JSON.stringify(this._message);
            data.sourceAsHex = this.hexadecimal.join(``);
        }

        data.header = {
            queryId: this.queryId,
            parameters: {
                asBinary: this._parameters,
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
