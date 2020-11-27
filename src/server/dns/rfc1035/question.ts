// Application Modules
import { ResourceRecord } from "./resourceRecord";
import { ReadUInt16, WriteUInt16 } from "../../utilities";
import { Trace } from "multi-level-logger";
import { ICacheId } from "../../../interfaces/configuration/dns";

class Question extends ResourceRecord implements ICacheId {
    constructor() {
        super();
    }

    EncodeToDNS(message: Array<number>): void {
        ResourceRecord.EncodeLabel(message, this.label);
        WriteUInt16(message, this.typeId);
        WriteUInt16(message, this.classId);
    }

    DecodeFromDNS(message: Array<number>, offset: number): number {
        this.startingOffset = offset;

        Trace(`Decode question label at offset ${offset}`, { logName: `dns` });
        ({ value: this.label, offset } = ResourceRecord.DecodeLabel(message, offset));

        ({ value: this.typeId, offsetAfterRead: offset } = ReadUInt16(message, offset));

        ({ value: this.classId, offsetAfterRead: offset } = ReadUInt16(message, offset));

        return offset;
    }
}

export {
    Question,
};
