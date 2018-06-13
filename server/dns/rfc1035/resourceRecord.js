const { ReadString, ReadUInt8 } = require(`../../utilities`);

let typeMap = {
    "1": `A`,
    "2": `NS`,
    "3": `MD`,
    "4": `MF`,
    "5": `CNAME`,
    "6": `SOA`,
    "7": `MB`,
    "8": `MG`,
    "9": `MR`,
    "10": `NULL`,
    "11": `WKS`,
    "12": `PTR`,
    "13": `HINFO`,
    "14": `MINFO`,
    "15": `MX`,
    "16": `TXT`,
    "255": `*`,
};

let classMap = {
    "1": `IN`,
    "2": `CS`, // OBSOLETE
    "3": `CH`,
    "4": `HS`,
};

let _type = new WeakMap(),
    _class = new WeakMap();

class ResourceRecord {
    constructor() {}

    get typeMap() { return typeMap; }
    get classMap() { return classMap; }

    get rrTypeId() { return _type.get(this); }
    set rrTypeId(val) { _type.set(this, val); }
    get rrType() { return typeMap[this.rrTypeId]; }

    get rrClassId() { return _class.get(this); }
    set rrClassId(val) { _class.set(this, val); }
    get rrClass() { return classMap[this.rrClassId]; }

    static DecodeLabel(messageBuffer, offset) {
        let labelLength,
            labelData = [];

        do {
            ({ value: labelLength, offset } = ReadUInt8(messageBuffer, offset));
            if (labelLength > 0) {
                let label;
                ({ value: label, offset } = ReadString(messageBuffer, offset, labelLength));
                labelData.push(label);
            }
        } while (labelLength != 0);

        return { value: labelData.join(`.`), offset };
    }
}

module.exports.ResourceRecord = ResourceRecord;
