let _label = new WeakMap(),
    _typeId = new WeakMap(),
    _classId = new WeakMap();

class ResourceRecord {
    constructor() {}

    get label() { return _label.get(this); }
    set label(val) { _label.set(this, val); }

    get typeId() { return _typeId.get(this); }
    set typeId(val) { _typeId.set(this, val); }

    get classId() { return _classId.get(this); }
    set classId(val) { _classId.set(this, val); }
}

module.exports.ResourceRecord = ResourceRecord;
