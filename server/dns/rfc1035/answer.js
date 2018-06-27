// Application modules
const { ResourceRecord } = require(`./resourceRecord`),
    { Dev, } = require(`../../logging`);

let _ttlTimestamp = new WeakMap(),
    _startingTTL = new WeakMap(),
    _noExpiration = new WeakMap(),
    _rdata = new WeakMap();

class Answer extends ResourceRecord {
    constructor() {
        super();

        _ttlTimestamp.set(this, new Date());
        this.rdata = [];
    }

    get startingTTL() { return _startingTTL.get(this); }
    set startingTTL(val) { _startingTTL.set(this, val); }
    // noExpiration is used by records defined in configuration
    set noExpiration(val) { _noExpiration.set(this, val); }
    get ttlExpiration() {
        // For configuration-defined records, the expiration should always be in 10 seconds
        if (_noExpiration.get(this))
            return (new Date()).getTime() + 10000;
        else
            return (_ttlTimestamp.get(this).getTime() + (this.startingTTL * 1000));
    }

    get rdata() { return _rdata.get(this); }
    set rdata(val) { _rdata.set(this, val); }

    get summary() { return `[${this.typeId}/${this.classId}] ${this.label} --> ${this.rdata.join(`, `)}`; }

    DecodeFromDNS(messageArray, offset) {
        this.startingOffset = offset;

        Dev({ label: offset });
        ({ value: this.label, offset } = Answer.DecodeLabel(messageArray, offset));

        Dev({ typeIdOffset: offset });
        this.typeId = parseInt(messageArray.slice(offset, offset + 2).map(element => { return element.hexadecimal; }).join(``), 16);
        offset += 2;

        Dev({ classIdOffset: offset });
        this.classId = parseInt(messageArray.slice(offset, offset + 2).map(element => { return element.hexadecimal; }).join(``), 16);
        offset += 2;

        Dev({ ttlOffset: offset });
        this.startingTTL = parseInt(messageArray.slice(offset, offset + 4).map(element => { return element.hexadecimal; }).join(``), 16);
        offset += 4;

        offset = this._setRdata(messageArray, offset);

        return offset;
    }

    _setRdata(messageArray, offset) {
        // Get the resource data length
        let rdLength = parseInt(messageArray.slice(offset, offset + 2).map(element => { return element.hexadecimal; }).join(``), 16);
        Dev({ rdLengthOffset: offset, rdLength });
        offset += 2;

        // Parse the resource data
        let source = messageArray.slice(offset, offset + rdLength);

        switch (this.typeId) {
            // A record
            case 1: {
                // Decode the IP address(es)
                let sourceOffset = 0;
                while (sourceOffset < source.length) {
                    let ip = [];
                    for (let idx = 0; idx < 4; idx++)
                        ip.push(source[idx].decimal);
                    this.rdata.push(ip.join(`.`));
                    sourceOffset += 4;
                }
            }
                break;

            // CNAME record
            case 5: {
                // Decode the label
                let rData;
                ({ value: rData } = Answer.DecodeLabel(messageArray, offset));
                this.rdata.push(rData);
            }
                break;

            default:
                this.rdata.push(source.map(element => { return element.hexadecimal; }).join(``));
        }

        offset += rdLength;

        return offset;
    }

    EncodeToDNS(messageArray) {
        Answer.EncodeLabel(messageArray, this.label);
        Answer.WriteBytes(messageArray, 2, this.typeId);
        Answer.WriteBytes(messageArray, 2, this.classId);
        Answer.WriteBytes(messageArray, 4, Math.round((this.ttlExpiration - (new Date()).getTime()) / 1000));

        this._getRdata(messageArray);
    }

    _getRdata(messageArray) {
        // Get the resource data
        switch (this.typeId) {
            // A record
            case 1: {
                let rDataBytes = [];

                this.rdata.forEach(ip => {
                    let ipParts = ip.split(`.`);
                    ipParts.forEach(element => {
                        Answer.WriteBytes(rDataBytes, 1, +element);
                    });
                });

                Answer.WriteBytes(messageArray, 2, rDataBytes.length);
                rDataBytes.forEach(rdata => {
                    messageArray.push(rdata);
                });
            }
                break;

            // CNAME record
            case 5: {
                this.rdata.forEach(label => {
                    let length = Answer.EncodeLabel(messageArray, label);

                    // Insert the length of the label prior to the label
                    let labelAdded = messageArray.splice(messageArray.length - length);
                    Answer.WriteBytes(messageArray, 2, length);
                    labelAdded.forEach(l => { messageArray.push(l); });
                });
            }
                break;
        }
    }

    toJSON() {
        return {
            startingOffset: this.startingOffset,
            label: this.label,
            typeId: this.typeId,
            classId: this.classId,
            startingTTL: this.startingTTL,
            rdata: this.rdata,
        };
    }
}

module.exports.Answer = Answer;
