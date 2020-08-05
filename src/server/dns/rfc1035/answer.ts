// NPM Modules
import { Dev } from "multi-level-logger";

// Application Modules
import { MessageByte, WriteBytes } from "./MessageByte";
import { ResourceRecord } from "./resourceRecord";
import { eDnsType, eMessageByteComponent } from "../../../interfaces/configuration/dns";

// This interface is only to be used internally by the Answer class
interface IInstantiateClone {
    answerToClone?: Answer;
}

/** Object wrapper for an answer to a DNS query */
class Answer extends ResourceRecord {
    constructor({ answerToClone }: IInstantiateClone = {}) {
        super();

        this.rdata = [];
        this._ttlTimestamp = new Date();

        if (!!answerToClone) {
            this.label = answerToClone.label;
            this.typeId = answerToClone.typeId;
            this.classId = answerToClone.classId;
            // newAnswer.startingTTL = this.startingTTL;
            this._ttlTimestamp = answerToClone.ttlTimestamp;
            this.noExpiration = answerToClone.noExpiration;
            this.cacheRemoval = answerToClone.cacheRemoval;

            this.rdata = answerToClone.rdata.filter(() => true);
        }
    }

    // Properties
    private _ttlTimestamp: Date;

    public cacheRemoval: ReturnType<typeof setTimeout>;
    public noExpiration: boolean;
    public rdata: Array<string>;
    public startingTTL: number;

    // Accessors
    public get ttlExpiration(): number {
        // For configuration-defined records, the expiration should always be in 10 seconds
        if (this.noExpiration)
            return (new Date()).getTime() + 10000;
        else
            return (this._ttlTimestamp.getTime() + (this.startingTTL * 1000));
    }
    public get ttlTimestamp(): Date { return this._ttlTimestamp; }

    /** Summary of this DNS Answer */
    get summary(): string { return `[${this.typeId}/${this.classId}] ${this.label} --> ${this.rdata.join(`, `)}`; }

    // Methods
    public Clone(): Answer {
        const newAnswer = new Answer({ answerToClone: this });
        return newAnswer;
    }

    public DecodeFromDNS(message: Array<MessageByte>, offset: number): number {
        this.startingOffset = offset;

        Dev({ label: offset }, { logName: `dns` });
        ({ value: this.label, offset } = Answer.DecodeLabel(message, offset));

        Dev({ typeIdOffset: offset }, { logName: `dns` });
        this.typeId = parseInt(message.slice(offset, offset + 2).map(element => element.hexadecimal).join(``), 16);
        offset += 2;

        Dev({ classIdOffset: offset }, { logName: `dns` });
        this.classId = parseInt(message.slice(offset, offset + 2).map(element => element.hexadecimal).join(``), 16);
        offset += 2;

        Dev({ ttlOffset: offset }, { logName: `dns` });
        this.startingTTL = parseInt(message.slice(offset, offset + 4).map(element => element.hexadecimal).join(``), 16);
        offset += 4;

        offset = this.setResourceData(message, offset);

        return offset;
    }

    public EncodeToDNS(message: Array<MessageByte>): void {
        ResourceRecord.EncodeLabel(message, this.label);

        WriteBytes(message, 2, this.typeId);
        WriteBytes(message, 2, this.classId);
        // Write the TTL from now for the answer
        WriteBytes(message, 4, Math.round((this.ttlExpiration - (new Date()).getTime()) / 1000));

        this.getResourceData(message);
    }

    private setResourceData(message: Array<MessageByte>, offset: number): number {
        // Get the resource data length
        const rdLength = parseInt(message.slice(offset, offset + 2).map(element => element.hexadecimal).join(``), 16);
        Dev({ rdLengthOffset: offset, rdLength }, { logName: `dns` });
        offset += 2;

        // Parse the resource data
        const source = message.slice(offset, offset + rdLength);

        switch (this.typeId) {
            // A record
            case eDnsType.A: {
                // Decode the IP address(es)
                let sourceOffset = 0;
                while (sourceOffset < source.length) {
                    const ip: Array<number> = [];
                    for (let idx = 0; idx < 4; idx++)
                        ip.push(source[idx].decimal);
                    this.rdata.push(ip.join(`.`));
                    sourceOffset += 4;
                }
            }
                break;

            // CNAME record
            case eDnsType.CNAME: {
                // Decode the label
                const { value: rData } = Answer.DecodeLabel(message, offset);
                this.rdata.push(rData);
            }
                break;

            default:
                // Use the hexadecimal version of the data
                this.rdata.push(source.map(element => element.hexadecimal).join(``));
        }

        offset += rdLength;

        return offset;
    }

    /**
     * Add the resource data fields to the message
     */
    private getResourceData(message: Array<MessageByte>): void {
        switch (this.typeId) {
            case eDnsType.CNAME: {
                this.rdata.forEach(label => {
                    const length = ResourceRecord.EncodeLabel(message, label);

                    // Insert the length of the label prior to the label
                    const labelAdded = message.splice(message.length - length);
                    WriteBytes(message, 2, length);
                    labelAdded.forEach(label => { message.push(label); });
                });
            }
                break;

            // A records (typeId == 1) are included here with everything not CNAME
            default: {
                const rDataBytes: Array<MessageByte> = [];

                this.rdata.forEach(data => {
                    // Data will be in hexadecimal format, and needs to split into an array
                    const dataParts = (this.typeId == eDnsType.A) ? data.split(`.`) : data.match(/../g);

                    dataParts.forEach(element => {
                        let elementType = eMessageByteComponent.hexadecimal,
                            elementValue: string | number = element;

                        if (this.typeId == eDnsType.A) {
                            elementValue = +element;
                            elementType = eMessageByteComponent.decimal;
                        }

                        WriteBytes(rDataBytes, 1, elementValue, elementType);
                    });
                });

                WriteBytes(message, 2, rDataBytes.length);
                rDataBytes.forEach(rdata => message.push(rdata));
            }
                break;
        }
    }
}

export {
    Answer,
};
