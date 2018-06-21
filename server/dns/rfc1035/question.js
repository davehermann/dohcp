// Application modules
const { ResourceRecord } = require(`./resourceRecord`);

let _startingOffset = new WeakMap();

class Question extends ResourceRecord {
    constructor() {
        super();
    }

    get startingOffset() { return _startingOffset.get(this); }
    set startingOffset(val) { _startingOffset.set(this, val); }

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
