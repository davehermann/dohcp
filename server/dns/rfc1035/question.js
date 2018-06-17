// Application modules
const { ResourceRecord } = require(`./resourceRecord`),
    { ReadUInt16 } = require(`../../utilities`);

let _label = new WeakMap();

class Question extends ResourceRecord {
    constructor(originalMessage, questionOffset) {
        super();
        this.sourceStartingOffset = questionOffset;

        this._decode(originalMessage, questionOffset);
    }

    get label() { return _label.get(this); }
    set label(val) { _label.set(this, val); }
    get qname() { return Question.EncodeLabelHex(this.label); }
    get qtype() { return this.rrTypeId.toString(16).padStart(4, `0`); }
    get qclass() { return this.rrClassId.toString(16).padStart(4, `0`); }

    _decode(messageBuffer, offset) {
        ({ value: this.label, offset } = Question.DecodeLabel(messageBuffer, offset));
        ({ value: this.rrTypeId, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.rrClassId, offset } = ReadUInt16(messageBuffer, offset));

        this.sourceEndingOffset = offset;
    }

    toHex() {
        this.hexRepresentation = `${this.qname}${this.qtype}${this.qclass}`;
        return this.hexRepresentation;
    }

    toJSON() {
        return {
            question: this.label,
            qType: this.rrType,
            qClass: this.rrClass,
        };
    }
}

module.exports.Question = Question;
