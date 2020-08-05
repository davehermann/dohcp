// Application Modules
import { MessageByte, WriteBytes } from "./MessageByte";
import { ResourceRecord } from "./resourceRecord";

class Question extends ResourceRecord {
    constructor() {
        super();
    }

    EncodeToDNS(message: Array<MessageByte>): void {
        ResourceRecord.EncodeLabel(message, this.label);
        WriteBytes(message, 2, this.typeId);
        WriteBytes(message, 2, this.classId);
    }

    DecodeFromDNS(message: Array<MessageByte>, offset: number): number {
        this.startingOffset = offset;

        ({ value: this.label, offset } = ResourceRecord.DecodeLabel(message, offset));

        this.typeId = parseInt(message.slice(offset, offset + 2).map(element => element.hexadecimal).join(``), 16);
        offset += 2;

        this.classId = parseInt(message.slice(offset, offset + 2).map(element => element.hexadecimal).join(``), 16);
        offset += 2;

        return offset;
    }
}

export {
    Question,
};
