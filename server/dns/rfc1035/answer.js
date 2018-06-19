// Application modules
const { ResourceRecord } = require(`./resourceRecord`),
    { ReadIpAddress, ReadString, ReadUInt16, ReadUInt32 } = require(`../../utilities`);

let _name = new WeakMap(),
    _rData = new WeakMap(),
    _ttl = new WeakMap(),
    _ttlSetTime = new WeakMap();

class Answer extends ResourceRecord {
    constructor(originalMessage, answerOffset) {
        super();

        if (!!originalMessage) {
            this.sourceStartingOffset = answerOffset;
            this._decode(originalMessage, answerOffset);
        }
    }

    get label() { return _name.get(this); }
    set label(val) { _name.set(this, val); }
    get name() { return Answer.EncodeLabelHex(this.label); }
    get type() { return this.rrTypeId.toString(16).padStart(4, `0`); }
    get class() { return this.rrClassId.toString(16).padStart(4, `0`); }

    get maximumCacheLength() {
        let ttl = _ttl.get(this);
        if (!!ttl) {
            // The TTL should be adjusted based on elapsed time from initial set
            let currentTime = (new Date()).getTime(),
                elapsedTTLTime = currentTime - _ttlSetTime.get(this);

            ttl -= Math.round(elapsedTTLTime / 1000);
        }

        return ttl;
    }
    set maximumCacheLength(val) {
        _ttl.set(this, val);
        // Record the timestamp for when this was set
        _ttlSetTime.set(this, (new Date()).getTime());
    }
    get ttl() { return this.maximumCacheLength.toString(16).padStart(8, `0`); }

    set rData(val) { _rData.set(this, val); }
    get resourceData() {
        switch (this.rrType) {
            case `A`: {
                // Resource is an IP address
                let rData = [],
                    recordData = Buffer.from(_rData.get(this), `hex`),
                    offset = 0,
                    value;
                // Each record will be 4 numbers, repeated if more than one IP is returned
                while (offset < recordData.length) {
                    ({ value, offset } = ReadIpAddress(recordData, offset));
                    rData.push(value);
                }

                return rData;
            }

            case `CNAME`: {
                // Resource is a name
                let recordData = Buffer.from(_rData.get(this), `hex`),
                    offset = 0,
                    value;

                ({ value, offset } = Answer.DecodeLabel(recordData, offset));

                return value;
            }
        }

        return _rData.get(this);
    }
    get rdata() {
        let data = _rData.get(this);
        // Include the length of the data as the starting hex
        return `${(data.length / 2).toString(16).padStart(4, `0`)}${data}`;
    }

    get summary() {
        return `[${this.rrType}/${this.rrClass}] ${this.resourceData}`;
    }

    _decode(messageBuffer, offset) {
        let rawName;
        ({ value: rawName, offset } = ReadString(messageBuffer, offset, 2, `hex`));
        // Convert the name to binary
        let binaryName = parseInt(rawName, 16).toString(2).padStart(rawName.length * 4, `0`);
        // If the first two bits are "1", name compression is in use and the next 14 denote where the name is in the buffer
        if (binaryName.substr(0, 2) == `11`) {
            let nameOffset = parseInt(binaryName.substr(2), 2), name;
            ({ value: name } = Answer.DecodeLabel(messageBuffer, nameOffset));
            this.label = name;
        }

        ({ value: this.rrTypeId, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.rrClassId, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.maximumCacheLength, offset } = ReadUInt32(messageBuffer, offset));

        let rdLength;
        ({ value: rdLength, offset } = ReadUInt16(messageBuffer, offset));
        ({ value: this.rData, offset } = ReadString(messageBuffer, offset, rdLength, `hex`));

        this.sourceEndingOffset = offset;
    }

    toHex(existingMessageHex) {
        let useName = this.name;
        // Get the name as a hex label
        let inMessage = existingMessageHex.search(useName);
        // Look for a pattern match, and use compression if found
        if (inMessage >= 0) {
            let binaryCompressedName = `11${(inMessage / 2).toString(2).padStart(14, `0`)}`;
            useName = parseInt(binaryCompressedName, 2).toString(16).padStart(4, `0`);
        }

        this.hexRepresentation = `${useName}${this.type}${this.class}${this.ttl}${this.rdata}`;
        return this.hexRepresentation;
    }

    toCache() {
        // Needs: name, type, class, ttl, and data
        let newAnswer = new Answer();

        newAnswer.label = this.label;
        newAnswer.rrTypeId = this.rrTypeId;
        newAnswer.rrClassId = this.rrClassId;
        newAnswer.maximumCacheLength = this.maximumCacheLength;
        newAnswer.rData = _rData.get(this);

        return newAnswer;
    }

    toJSON() {
        return {
            name: this.label,
            nameEncoded: this.name,
            type: this.rrType,
            class: this.rrClass,
            ttl: this.maximumCacheLength,
            resourceData: this.resourceData,
            rawRData: _rData.get(this),
        };
    }
}

module.exports.Answer = Answer;
