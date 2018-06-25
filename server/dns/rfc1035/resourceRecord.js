// Application modules
const { MessageByte } = require(`./messageByte`),
    { Dev, Trace, } = require(`../../logging`);

let _startingOffset = new WeakMap(),
    _label = new WeakMap(),
    _typeId = new WeakMap(),
    _classId = new WeakMap();

class ResourceRecord {
    constructor() {}

    get startingOffset() { return _startingOffset.get(this); }
    set startingOffset(val) { _startingOffset.set(this, val); }

    get label() { return _label.get(this); }
    set label(val) { _label.set(this, val); }

    get typeId() { return _typeId.get(this); }
    set typeId(val) { _typeId.set(this, val); }

    get classId() { return _classId.get(this); }
    set classId(val) { _classId.set(this, val); }

    static WriteBytes(messageArray, numberOfBytes, value, format = `decimal`) {
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

    static DecodeLabel(messageArray, offset) {
        let labelLength,
            labelData = [];

        do {
            // Check the first two bits for a value of "11"
            if (messageArray[offset].binary.substr(0, 2) == `11`) {
                let label, labelOffset = parseInt(messageArray.slice(offset, offset + 2).map(m => { return m.binary; }).join(``).substr(2), 2);
                ({ value: label } = ResourceRecord.DecodeLabel(messageArray, labelOffset));
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

    static EncodeLabel(messageArray, label) {
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
                ResourceRecord.WriteBytes(byteArray, 1, 0);
            else
                ResourceRecord.WriteBytes(byteArray, l.length, l, `string`);

            encodedParts.push(byteArray);
        });

        Trace({ labelParts, encodedParts });

        // For compression purposes, compare to the existing array
        // Each encoded part will be preceded by a length value of 1 byte
        // Compare the entire label, and then compare each subseqent string dropping the inital part until there is a match
        let hasMatch = false,
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
                    ResourceRecord.WriteBytes(messageArray, 2, matchBinary, `binary`);
                    writeCounter += 2;

                    // Remove the rest of the encodedParts
                    encodedParts = [];
                }
                // If no match is found, write the first encoded part, and try again
                else {
                    let writeLabelPart = encodedParts.shift();
                    ResourceRecord.WriteBytes(messageArray, 1, writeLabelPart.length);
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
}

module.exports.ResourceRecord = ResourceRecord;
