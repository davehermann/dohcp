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
    _class = new WeakMap(),
    _sourceStartingOffset = new WeakMap(),
    _sourceEndingOffset = new WeakMap(),
    _asHex = new WeakMap();

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

    set sourceStartingOffset(val) { _sourceStartingOffset.set(this, val); }
    set sourceEndingOffset(val) { _sourceEndingOffset.set(this, val); }
    get endingOffset() { return _sourceEndingOffset.get(this); }
    get hexRepresentation() { return _asHex.get(this); }
    set hexRepresentation(val) { _asHex.set(this, val); }
    get length() { return this.hexRepresentation.length / 2; }

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

    static EncodeLabelHex(labelString) {
        let labelParts = labelString.split(`.`),
            labelData = ``;

        labelParts.forEach(label => {
            // Convert each character
            let labelHex = ``;
            for (let idx = 0, total = label.length; idx < total; idx++)
                labelHex += label.charCodeAt(idx).toString(16).padStart(2, `0`);

            // Add the length as a hexadecimal number, and then the label
            labelData += `${(labelHex.length / 2).toString(16).padStart(2, `0`)}${labelHex}`;
        });

        // End the labels
        labelData += `00`;

        return labelData;
    }
}

module.exports.ResourceRecord = ResourceRecord;
