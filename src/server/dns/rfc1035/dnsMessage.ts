// NPM Modules
import { Dev, Trace } from "multi-level-logger";

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
}

export {
    DnsMessage as DNSMessage,
};
