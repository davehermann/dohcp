// Application modules
const { MessageByte } = require(`./messageByte`),
    { Question } = require(`./question`),
    { Dev, Trace, Debug, Warn, Err } = require(`../../logging`);

let _master = new WeakMap(),
    _questions = new WeakMap(),
    _answers = new WeakMap();

class DNSMessage {
    constructor() {
        _master.set(this, []);
        _questions.set(this, []);
        _answers.set(this, []);
    }

    get hexadecimal() { return _master.get(this).map(element => { return element.hexadecimal; }); }
    get binary() { return _master.get(this).map(element => { return element.binary; }); }

    // Header ---------------------------------------------------------------------------
    // Query ID is the first two entries
    get queryId() { return parseInt(this.hexadecimal.slice(0, 2).join(``), 16); }
    // Parameters - the next 16 bits (2 bytes) -------------------------------------
    get _parameters() { return this.binary.slice(2, 4).join(``); }
    // QR is the first bit on the parameters
    get qr() { return +this._parameters.substr(0, 1);}
    // Opcode is the next 4 bits
    get opcode() { return parseInt(this._parameters.substr(1, 4), 2); }
    // Authoritative Answer
    get aa() { return +this._parameters.substr(5, 1) === 1; }
    // Is answer truncated
    get tc() { return +this._parameters.substr(6, 1) === 1; }
    // Recursion Desired?
    get rd() { return +this._parameters.substr(7, 1) === 1; }
    // Recursion Available
    get ra() { return +this._parameters.substr(8, 1) === 1; }
    // Z (reserved for future use)
    get z() { return parseInt(this._parameters.substr(9, 3), 2); }
    // Response Code
    get rcode() { return parseInt(this._parameters.substr(12, 4), 2); }
    // End Parameters --------------------------------------------------------------
    // Number of Questions
    get qdcount() { return parseInt(this.hexadecimal.slice(4, 6).join(``), 16); }
    // Number of Answers
    get ancount() { return parseInt(this.hexadecimal.slice(6, 8).join(``), 16); }
    // Number of Authority Records
    get nscount() { return parseInt(this.hexadecimal.slice(8, 10).join(``), 16); }
    // Number of Additional Records
    get arcount() { return parseInt(this.hexadecimal.slice(10, 12).join(``), 16); }
    // End Header -----------------------------------------------------------------------

    // Questions ------------------------------------------------------------------------
    get questions() { return _questions.get(this); }
    // End Questions --------------------------------------------------------------------

    // Answers --------------------------------------------------------------------------
    get answers() { return _answers.get(this); }
    // End Answers ----------------------------------------------------------------------

    // As a DNS message
    get dnsMessage() { return Buffer.from(this.hexadecimal.join(``), `hex`); }

    FromDNS(msg) {
        // Generate a respresentation where each array index contains decimal, hex, and binary representations
        let messageMaster = [],
            currentTime = new Date();
        for (let offset = 0; offset < msg.length; offset++)
            messageMaster.push(new MessageByte(msg.readUInt8(offset)));
        _master.set(this, messageMaster);

        // Parse questions
        let questions = [],
            offset = 12;
        for (let qIdx = 0; qIdx < this.qdcount; qIdx++) {
            let q = new Question();
            q.startingOffset = offset;
            ({ value: q.label, offset} = decodeLabel(messageMaster, offset));
            q.typeId = parseInt(this.hexadecimal.slice(offset, offset + 2).join(``), 16);
            offset += 2;
            q.classId = parseInt(this.hexadecimal.slice(offset, offset + 2).join(``), 16);
            offset += 2;

            questions.push(q);
        }
        _questions.set(this, questions);

        // Parse answers
        this.hexadecimal.forEach((element, idx) => {
            Dev(`${idx.toString().padStart(3, `0`)}: ${element}`);
        });

        let answers = [];
        for (let aIdx = 0; aIdx < this.ancount; aIdx++) {
            let a = {
                startingOffset: offset,
                ttlTimestamp: currentTime,
                rdata: [],

                toJSON: function() {
                    return {
                        label: this.label,
                        typeId: this.typeId,
                        classId: this.classId,
                        startingTTL: this.startingTTL,
                        startingOffset: this.startingOffset,
                        rdata: this.rdata,
                    };
                }
            };
            a.__defineGetter__(`summary`, function() {
                return `[${this.typeId}/${this.classId}] ${this.label} --> ${this.rdata.join(`, `)}`;
            });
            a.__defineGetter__(`ttlExpiration`, function() {
                return (this.ttlTimestamp.getTime() + (this.startingTTL * 1000));
            });

            Dev({ label: offset });
            ({ value: a.label, offset } = decodeLabel(messageMaster, offset));
            Dev({ typeIdOffset: offset });
            a.typeId = parseInt(this.hexadecimal.slice(offset, offset + 2).join(``), 16);
            offset += 2;
            Dev({ classIdOffset: offset });
            a.classId = parseInt(this.hexadecimal.slice(offset, offset + 2).join(``), 16);
            offset += 2;
            Dev({ ttlOffset: offset });
            a.startingTTL = parseInt(this.hexadecimal.slice(offset, offset + 4).join(``), 16);
            offset += 4;

            // Get the resource data length
            let rdLength = parseInt(this.hexadecimal.slice(offset, offset + 2).join(``), 16);
            Dev({ rdLengthOffset: offset, rdLength });
            offset += 2;

            // Parse the resource data
            let source = _master.get(this).slice(offset, offset + rdLength);

            switch (a.typeId) {
                // A record
                case 1: {
                    // Decode the IP address(es)
                    let sourceOffset = 0;
                    while (sourceOffset < source.length) {
                        let ip = [];
                        for (let idx = 0; idx < 4; idx++)
                            ip.push(source[idx].decimal);
                        a.rdata.push(ip.join(`.`));
                        sourceOffset += 4;
                    }
                }
                    break;

                // CNAME record
                case 5: {
                    // Decode the label
                    let rData;
                    ({ value: rData } = decodeLabel(messageMaster, offset));
                    a.rdata.push(rData);
                }
                    break;

                default:
                    a.rdata.push(source.map(element => { return element.hexadecimal; }).join(``));
            }

            offset += rdLength;
            Trace(a);

            answers.push(a);
        }
        _answers.set(this, answers);
    }

    AddQuestions(questionLabelArray) {
        questionLabelArray.forEach(question => {
            let q = new Question();
            q.label = question;
            q.typeId = 1;
            q.classId = 1;
            _questions.get(this).push(q);
        });
    }

    AddAnswers(answerArray) {
        answerArray.forEach(answer => {
            _answers.get(this).push(answer);
        });
    }

    Generate(queryId, isReply, recursionDesired) {
        // Clear the master data
        let messageMaster = [];

        // Create a header
        if ((queryId === undefined) || (queryId === null))
            queryId = Math.round(Math.random() * 65000);

        this._writeHeader(messageMaster, queryId, isReply, recursionDesired);

        // Write the questions
        this.questions.forEach(q => {
            encodeLabel(messageMaster, q.label);
            writeBytes(messageMaster, 2, q.typeId);
            writeBytes(messageMaster, 2, q.classId);
        });

        // Write the answers
        this.answers.forEach(a => {
            encodeLabel(messageMaster, a.label);
            writeBytes(messageMaster, 2, a.typeId);
            writeBytes(messageMaster, 2, a.classId);
            writeBytes(messageMaster, 4, Math.round((a.ttlExpiration - (new Date()).getTime()) / 1000));

            // Get the resource data
            let rdata;
            switch (a.typeId) {
                // A record
                case 1: {
                    let rDataBytes = [];

                    a.rdata.forEach(ip => {
                        let ipParts = ip.split(`.`);
                        ipParts.forEach(element => {
                            writeBytes(rDataBytes, 1, +element);
                        });
                    });

                    writeBytes(messageMaster, 2, rDataBytes.length);
                    rDataBytes.forEach(rdata => {
                        messageMaster.push(rdata);
                    });
                }
                    break;

                // CNAME record
                case 5: {
                    let rDataBytes = [];

                    a.rdata.forEach(label => {
                        let length = encodeLabel(messageMaster, label);

                        // Insert the length of the label prior to the label
                        let labelAdded = messageMaster.splice(messageMaster.length - length);
                        writeBytes(messageMaster, 2, length);
                        labelAdded.forEach(l => { messageMaster.push(l); });
                    });
                }
                    break;
            }
        });

        _master.set(this, messageMaster);
    }
    _writeHeader(messageMaster, queryId, isReply, recursionDesired) {
        // Query ID is 2 bytes
        writeBytes(messageMaster, 2, queryId);

        // Parameters section is 2 bytes, written as 16 bits
        let header = ``;
        // QR is 1 bit
        header += (isReply ? 1 : 0);
        // OPCODE is 4 bits
        header += `0000`;
        // AA is 1 bit
        header += `0`;
        // TC is 1 bit
        header += `0`;
        // RD is 1 bit, based on the desired for an answer
        header += (isReply ? (recursionDesired ? 1 : 0) : 1);
        // RA is 1 bit
        header += (isReply ? 1 : 0);
        // Z is 3 bits
        header += `000`;
        // RCODE is 4 bits
        header += `0000`;
        writeBytes(messageMaster, 2, header, `binary`);

        // Question count
        writeBytes(messageMaster, 2, this.questions.length);
        // Answer count
        writeBytes(messageMaster, 2, this.answers.length);
        // Authority records count
        writeBytes(messageMaster, 2, 0);
        // Additional records count
        writeBytes(messageMaster, 2, 0);
    }

    toJSON() {
        return {
            source: _master.get(this),
            hex: this.hexadecimal,
            bin: this.binary,
            header: {
                queryId: this.queryId,
                parameters: {
                    asBinary: this.binary.slice(2, 4).join(``),
                    qr: this.qr,
                    opcode: this.opcode,
                    aa: this.aa,
                    tc: this.tc,
                    rd: this.rd,
                    ra: this.ra,
                    z: this.z,
                    rcode: this.rcode,
                },
                qdcount: this.qdcount,
                ancount: this.ancount,
                nscount: this.nscount,
                arcount: this.arcount,
            },
            questions: this.questions,
            answers: this.answers,
        };
    }
}

function writeBytes(messageArray, numberOfBytes, value, format = `decimal`) {
    // Convert value to binary
    let binaryValue;
    switch (format) {
        case `decimal`:
            binaryValue = value.toString(2).padStart(numberOfBytes * 8, `0`);
            break;

        case `hexadecimal`:
            binaryValue = parseInt(value, 16).toString(2).padStart(numberOfBytes * 8, `0`);
            break;

        case `binary`:
            binaryValue = value.padStart(numberOfBytes * 8, `0`);
            break;

        case `string`: {
            let binArray = [];
            for (let idx = 0; idx < value.length; idx++)
                binArray.push(value.charCodeAt(idx).toString(2).padStart(8, `0`));

            binaryValue = binArray.join(``);
        }
            break;
    }

    // Separate into each 8-bit byte
    let binaryArray = binaryValue.match(/......../g);

    // Add each byte to the array
    binaryArray.forEach(value => {
        messageArray.push(new MessageByte(value, `binary`));
    });
}

function decodeLabel(messageArray, offset) {
    let labelLength,
        labelData = [];

    do {
        // Check the first two bits for a value of "11"
        if (messageArray[offset].binary.substr(0, 2) == `11`) {
            let label, labelOffset = parseInt(messageArray.slice(offset, offset + 2).map(m => { return m.binary; }).join(``).substr(2), 2);
            ({ value: label } = decodeLabel(messageArray, labelOffset));
            label.split(`.`).forEach(l => { labelData.push(l); });

            // Advance the offset 2 bytes
            offset += 2;
            // And set the label length to 0
            labelLength = 0;
        } else {
            // Read a length for the label part
            labelLength = messageArray[offset].decimal;
            // Advance the offset
            offset++;

            if (labelLength > 0) {
                // Read the label
                let label = ``;

                label = String.fromCharCode.apply(this, messageArray.slice(offset, offset + labelLength).map(d => { return d.decimal; }));
                labelData.push(label);

                offset += labelLength;
            }
        }
    } while (labelLength != 0);

    return { value: labelData.join(`.`), offset };
}

function encodeLabel(messageArray, label) {
    // Split the label
    let labelParts = label.split(`.`),
        encodedParts = [],
        writeCounter = 0;

    // Add a byte of 0 to the end
    labelParts.push(null);

    // Convert each part to a byte array
    labelParts.forEach(l => {
        let byteArray = [];

        if (l === null)
            writeBytes(byteArray, 1, 0);
        else
            writeBytes(byteArray, l.length, l, `string`);

        encodedParts.push(byteArray);
    });

    Trace({ labelParts, encodedParts });

    // For compression purposes, compare to the existing array
    // Each encoded part will be preceded by a length value of 1 byte
    // Compare the entire label, and then compare each subseqent string dropping the inital part until there is a match
    let hasMatch = false,
        startIndex = 0,
        messageHex = messageArray.map(element => { return element.hexadecimal; }).join(``);
    Dev(`Current message: `, messageHex);

    do {
        // Ignore the ending null byte when checking for prior matches
        if (encodedParts.length > 1) {
            let labelHex = ``;
            encodedParts.forEach((l, idx) => {
                // For the end null value, simply write the value
                if (idx == (encodedParts.length - 1))
                    labelHex += l[0].hexadecimal;
                else {
                    let partHex = ``;
                    partHex += l.length.toString(16).padStart(2, `0`);

                    l.forEach(letter => {
                        partHex += letter.hexadecimal;
                    });

                    labelHex += partHex;
                }
            });

            // Check the message for a match
            Trace({ [`Checking ${encodedParts.length - 1} parts`]: labelHex });
            let findMatch = messageHex.search(new RegExp(labelHex));
            Dev({ findMatch });

            hasMatch = (findMatch >= 0);
            // If the section matches, write 16 bits: "11" followed by the location in the string
            if (hasMatch) {
                let matchBinary = `11${(findMatch / 2).toString(2).padStart(14, `0`)}`;
                writeBytes(messageArray, 2, matchBinary, `binary`);
                writeCounter += 2;

                // Remove the rest of the encodedParts
                encodedParts = [];
            }
            // If no match is found, write the first encoded part, and try again
            else {
                let writeLabelPart = encodedParts.shift();
                writeBytes(messageArray, 1, writeLabelPart.length);
                writeCounter += (1 + writeLabelPart.length);
                writeLabelPart.forEach(l => { messageArray.push(l); });
            }
        }
        // Write the ending byte
        else {
            encodedParts.shift().forEach(l => { messageArray.push(l); writeCounter++; });
        }
    } while (!hasMatch && (encodedParts.length > 0));

    return writeCounter;
}

module.exports.DNSMessage = DNSMessage;
