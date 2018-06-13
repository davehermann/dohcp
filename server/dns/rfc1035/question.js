// Application modules
const { ResourceRecord } = require(`./resourceRecord`),
    { ReadUInt16 } = require(`../../utilities`);

let _question = new WeakMap();


class Question extends ResourceRecord {
    constructor() {
        super();
    }

    get question() { return _question.get(this); }
    set question(val) { _question.set(this, val); }

    Decode(messageBuffer, offset) {
        ({ value: this.question, offset } = Question.DecodeLabel(messageBuffer, offset));
        ({ value: this.rrTypeId, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.rrClassId, offset } = ReadUInt16(messageBuffer, offset));

        return offset;
    }

    toJSON() {
        return {
            question: this.question,
            qType: this.rrType,
            qClass: this.rrClass,
        };
    }
}

module.exports.Question = Question;
