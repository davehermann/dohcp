// Application modules
const { ResourceRecord } = require(`./resourceRecord`),
    { Dev } = require(`../../logging`);

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
    // Used ONLY for cloning answer
    set _ttlTimestamp(val) { _ttlTimestamp.set(this, val); }
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

        Dev({ label: offset }, `dns`);
        ({ value: this.label, offset } = Answer.DecodeLabel(messageArray, offset));

        Dev({ typeIdOffset: offset }, `dns`);
        this.typeId = parseInt(messageArray.slice(offset, offset + 2).map(element => { return element.hexadecimal; }).join(``), 16);
        offset += 2;

        Dev({ classIdOffset: offset }, `dns`);
        this.classId = parseInt(messageArray.slice(offset, offset + 2).map(element => { return element.hexadecimal; }).join(``), 16);
        offset += 2;

        Dev({ ttlOffset: offset }, `dns`);
        this.startingTTL = parseInt(messageArray.slice(offset, offset + 4).map(element => { return element.hexadecimal; }).join(``), 16);
        offset += 4;

        offset = this._setRdata(messageArray, offset);

        return offset;
    }

    _setRdata(messageArray, offset) {
        // Get the resource data length
        let rdLength = parseInt(messageArray.slice(offset, offset + 2).map(element => { return element.hexadecimal; }).join(``), 16);
        Dev({ rdLengthOffset: offset, rdLength }, `dns`);
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
                // Use the hexadecimal version of the data
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

            // Everything else; A records (typeId == 1) are included here
            default: {
                let rDataBytes = [];

                this.rdata.forEach(data => {
                    // Data will be in hexadecimal format, and needs to split into an array
                    let dataParts = (this.typeId == 1) ? data.split(`.`) : data.match(/../g);

                    dataParts.forEach(element => {
                        let elementValue = element,
                            elementType = `hexadecimal`;

                        if (this.typeId == 1) {
                            elementValue = +element;
                            elementType = `decimal`;
                        }

                        Answer.WriteBytes(rDataBytes, 1, elementValue, elementType);
                    });
                });

                Answer.WriteBytes(messageArray, 2, rDataBytes.length);
                rDataBytes.forEach(rdata => { messageArray.push(rdata); });
            }
        }
    }

    Clone() {
        let newAnswer = new Answer();

        newAnswer.label = this.label;
        newAnswer.typeId = this.typeId;
        newAnswer.classId = this.classId;
        newAnswer.startingTTL = this.startingTTL;
        newAnswer._ttlTimestamp = _ttlTimestamp.get(this);
        newAnswer.noExpiration = _noExpiration.get(this);

        this.rdata.forEach(data => {
            newAnswer.rdata.push(data);
        });

        return newAnswer;
    }

    toJSON() {
        return {
            startingOffset: this.startingOffset,
            label: this.label,
            typeId: this.typeId,
            classId: this.classId,
            startingTTL: this.startingTTL,
            ttlExpiration: this.ttlExpiration,
            rdata: this.rdata,
        };
    }
}

module.exports.Answer = Answer;
