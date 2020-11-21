// NPM Modules
import { Dev } from "multi-level-logger";

// Application Modules
import { ResourceRecord } from "./resourceRecord";
import { eDnsType, eDnsClass } from "../../../interfaces/configuration/dns";
import { ReadUInt16, ReadUInt32, ReadIPAddress, ToHexadecimal, WriteUInt16, WriteUInt32, WriteUInt8 } from "../../utilities";

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

    public DecodeFromDNS(message: Array<number>, offset: number): number {
        this.startingOffset = offset;

        Dev({ [`Answer label offset`]: offset }, { logName: `dns` });
        ({ value: this.label, offset } = Answer.DecodeLabel(message, offset));

        Dev({ typeIdOffset: offset }, { logName: `dns` });
        ({ value: this.typeId, offsetAfterRead: offset } = ReadUInt16(message, offset));

        Dev({ classIdOffset: offset }, { logName: `dns` });
        ({ value: this.classId, offsetAfterRead: offset } = ReadUInt16(message, offset));

        Dev({ ttlOffset: offset }, { logName: `dns` });
        ({ value: this.startingTTL, offsetAfterRead: offset} = ReadUInt32(message, offset));

        offset = this.setResourceData(message, offset);

        return offset;
    }

    public EncodeToDNS(message: Array<number>): void {
        ResourceRecord.EncodeLabel(message, this.label);

        WriteUInt16(message, this.typeId);
        WriteUInt16(message, this.classId);
        // Write the TTL from now for the answer
        WriteUInt32(message, Math.round((this.ttlExpiration - (new Date()).getTime()) / 1000));

        this.getResourceData(message);
    }

    private setResourceData(message: Array<number>, offset: number): number {
        // Get the resource data length
        let rdLength: number;
        ({ value: rdLength, offsetAfterRead: offset} = ReadUInt16(message, offset));
        Dev({ rdLengthOffset: offset, rdLength }, { logName: `dns` });

        // Parse the resource data
        const source = message.slice(offset, offset + rdLength);

        switch (this.typeId) {
            // A record
            case eDnsType.A: {
                // Decode the IP address(es)
                let sourceOffset = 0;
                while (sourceOffset < source.length) {
                    let ipAddress: string;
                    ({ value: ipAddress, offsetAfterRead: sourceOffset } = ReadIPAddress(source, sourceOffset));
                    this.rdata.push(ipAddress);
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
                this.rdata.push(ToHexadecimal(Uint8Array.from(source)).join(``));
        }

        offset += rdLength;

        return offset;
    }

    /**
     * Add the resource data fields to the message
     */
    private getResourceData(message: Array<number>): void {
        switch (this.typeId) {
            case eDnsType.CNAME: {
                this.rdata.forEach(label => {
                    const length = ResourceRecord.EncodeLabel(message, label);

                    // Insert the length of the label prior to the label
                    const labelAdded = message.splice(message.length - length);
                    WriteUInt16(message, length);
                    labelAdded.forEach(label => { message.push(label); });
                });
            }
                break;

            // A records (typeId == 1) are included here with everything not CNAME
            default: {
                const rDataBytes: Array<number> = [];

                this.rdata.forEach(data => {
                    // Data will be in hexadecimal format, and needs to split into an array
                    const dataParts = (this.typeId == eDnsType.A) ? data.split(`.`) : data.match(/../g);

                    dataParts.forEach(element => {
                        const elementValue: number = (this.typeId == eDnsType.A) ? +element : parseInt(element, 16);

                        WriteUInt8(rDataBytes, elementValue);
                    });
                });

                WriteUInt16(message, rDataBytes.length);
                rDataBytes.forEach(rdata => message.push(rdata));
            }
                break;
        }
    }

    /** Used for logging */
    public toJSON(): any {
        const data = {
            rdata: this.rdata,
            ttlTimestamp: this.ttlTimestamp,
            ttlExpiration: this.ttlExpiration,
            startingTTL: this.startingTTL,
            noExpiration: this.noExpiration,
            label: this.label,
            startingOffset: this.startingOffset,
            typeId: eDnsType[this.typeId],
            classId: eDnsClass[this.classId],
        };

        return data;
    }
}

export {
    Answer,
};
