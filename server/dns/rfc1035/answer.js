// Application modules
const { ResourceRecord } = require(`./resourceRecord`),
    { ReadIpAddress, ReadString, ReadUInt16, ReadUInt32 } = require(`../../utilities`);

let _compressedName = new WeakMap(),
    _name = new WeakMap(),
    _rdLength = new WeakMap(),
    _rdata = new WeakMap(),
    _ttl = new WeakMap(),
    _ttlSetTime = new WeakMap();

class Answer extends ResourceRecord {
    constructor() {
        super();
    }

    get compressedName() { return _compressedName.get(this); }
    set compressedName(val) { _compressedName.set(this, val); }
    get compressedNameBinary() { return !!this.compressedName ? parseInt(this.compressedName, 16).toString(2).padStart(this.compressedName.length * 4, `0`) : undefined; }
    get isCompressedName() { return !!this.compressedNameBinary ? this.compressedNameBinary.substr(0, 2) === `11` : undefined; }
    get nameOffset() { return this.isCompressedName ? parseInt(this.compressedNameBinary.substr(2), 2) : undefined; }
    get name() { return _name.get(this); }
    set name(val) { _name.set(this, val); }

    get ttl() {
        let ttl = _ttl.get(this);
        if (!!ttl) {
            // The TTL should be adjusted based on elapsed time from initial set
            let currentTime = (new Date()).getTime(),
                elapsedTTLTime = currentTime - _ttlSetTime.get(this);

            ttl -= Math.round(elapsedTTLTime / 1000);
        }

        return ttl;
    }
    set ttl(val) {
        _ttl.set(this, val);
        // Record the timestamp for when this was set
        _ttlSetTime.set(this, (new Date()).getTime());
    }

    get rdLength() { return _rdLength.get(this); }
    set rdLength(val) { _rdLength.set(this, val); }

    get rData() { return _rdata.get(this); }
    set rData(val) { _rdata.set(this, val); }
    get rDataDecoded() {
        let rData = [];

        switch (this.rrType) {
            case `A`: {
                let allData = Buffer.from(this.rData, `hex`), offset = 0, value;
                // Each record will be 4 numbers, repeated if more than one IP is returned
                while (offset < allData.length) {
                    ({ value, offset } = ReadIpAddress(allData, offset));
                    rData.push(value);
                }
            }
                break;
        }

        return rData;
    }

    Decode(messageBuffer, offset) {
        ({ value: this.compressedName, offset } = ReadString(messageBuffer, offset, 2, `hex`));
        ({ value: this.rrTypeId, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.rrClassId, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.ttl, offset } = ReadUInt32(messageBuffer, offset));
        ({ value: this.rdLength, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.rData, offset } = ReadString(messageBuffer, offset, this.rdLength, `hex`));

        // Expand the answer name
        if (this.isCompressedName)
            ({ value: this.name } = Answer.DecodeLabel(messageBuffer, this.nameOffset));

        return offset;
    }

    Copy() {
        let newAnswer = new Answer();

        newAnswer.name = this.name;
        newAnswer.rrTypeId = this.rrTypeId;
        newAnswer.rrClassId = this.rrClassId;
        newAnswer.ttl = this.ttl;
        newAnswer.rdLength = this.rdLength;
        newAnswer.rData = this.rData;

        return newAnswer;
    }

    toJSON() {
        return {
            compressedName: this.compressedName,
            compressedNameBinary: this.compressedNameBinary,
            isCompressedName: this.isCompressedName,
            nameStarts: this.nameStarts,
            name: this.name,
            aType: this.rrType,
            aClass: this.rrClass,
            ttl: this.ttl,
            rdLength: this.rdLength,
            rData: this.rData,
            rDataDecoded: this.rDataDecoded,
        };
    }
}

module.exports.Answer = Answer;
