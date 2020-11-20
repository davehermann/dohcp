// Application Modules
import { MessageByte, WriteBytes } from "./MessageByte";
import { ResourceRecord } from "./resourceRecord";
import { ReadUInt16, WriteUInt16 } from "../../utilities";

class Question extends ResourceRecord {
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

        ({ value: this.label, offset } = ResourceRecord.DecodeLabel(message, offset));

        ({ value: this.typeId, offsetAfterRead: offset } = ReadUInt16(message, offset));

        ({ value: this.classId, offsetAfterRead: offset } = ReadUInt16(message, offset));

        return offset;
    }
}

export {
    Question,
};
