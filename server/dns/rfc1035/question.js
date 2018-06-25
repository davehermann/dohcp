// Application modules
const { ResourceRecord } = require(`./resourceRecord`);

class Question extends ResourceRecord {
    constructor() {
        super();
    }

    DecodeFromDNS(messageArray, offset) {
        this.startingOffset = offset;

        ({ value: this.label, offset} = Question.DecodeLabel(messageArray, offset));

        this.typeId = parseInt(messageArray.slice(offset, offset + 2).map(element => { return element.hexadecimal; }).join(``), 16);
        offset += 2;

        this.classId = parseInt(messageArray.slice(offset, offset + 2).map(element => { return element.hexadecimal; }).join(``), 16);
        offset += 2;

        return offset;
    }

    EncodeToDNS(messageArray) {
        Question.EncodeLabel(messageArray, this.label);
        Question.WriteBytes(messageArray, 2, this.typeId);
        Question.WriteBytes(messageArray, 2, this.classId);
    }

    toJSON() {
        return {
            startingOffset: this.startingOffset,
            label: this.label,
            typeId: this.typeId,
            classId: this.classId,
        };
    }
}

module.exports.Question = Question;
