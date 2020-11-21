// NPM Modules
import { Dev, Trace } from "multi-level-logger";

// Application Modules
import { eDnsClass, eDnsType, ILabel } from "../../../interfaces/configuration/dns";
import { ReadUInt8, ReadUInt16, ReadString, WriteUInt8, WriteString, ToHexadecimal, WriteUInt16, BinaryToNumberArray } from "../../utilities";

class ResourceRecord {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}

    /** The offset to start reading */
    public startingOffset: number;

    /** The hostname value for the record */
    public label: string;

    /** The DNS record type */
    public typeId: eDnsType;

    /** The DNS record class */
    public classId: eDnsClass;

    /** Decode the label(s) from a DNS message */
    static DecodeLabel(messageArray: Array<number>, offset: number): ILabel {
        const labelData: Array<string> = [],
            originalOffset = offset;
        let labelLength: number;

        Trace({ [`Label offset`]: offset, [`Offset to end of message decode`]: JSON.stringify(messageArray.slice(offset)) });
        do {
            // Get the 16-bit value at the start of the offset
            const offsetBytesAsBinary: string = messageArray.slice(offset, offset + 2).map(byteValue => byteValue.toString(2).padStart(8, `0`)).join(``);
            // If the first two bits are "11"
            if (offsetBytesAsBinary.substr(0, 2) == `11`) {
                // Read the binary without the two "11" bits
                const labelOffset = ReadUInt16(BinaryToNumberArray(offsetBytesAsBinary.substr(2), 2), 0).value;
                Trace(`Compression in-use. Read from offset ${labelOffset}`);
                // Manually advance the offset as the ReadUInt16 operates on a newly instantiated array
                offset += 2;

                const { value: label } = ResourceRecord.DecodeLabel(messageArray, labelOffset);
                Dev({ labelOffset, label, offset });

                label.split(`.`).forEach(l => { labelData.push(l); });

                // And set the label length to 0
                labelLength = 0;
            } else {
                // Read a length for the label part
                ({ value: labelLength, offsetAfterRead: offset } = ReadUInt8(messageArray, offset));

                if (labelLength > 0) {
                    // Read the label
                    const { value, offsetAfterRead } = ReadString(messageArray, offset, labelLength);
                    labelData.push(value);

                    offset = offsetAfterRead;
                }
            }
        } while (labelLength != 0);
        Trace({ [`Decoded label from offset ${originalOffset}`]: `[${labelData.toString().replace(/"/g, ``)}]` }, { logName: `dns` });

        return { value: labelData.join(`.`), offset };
    }

    /** Encode a label into a DNS message */
    static EncodeLabel(message: Array<number>, label: string): number {
        // Split the label
        const labelParts = label.split(`.`),
            encodedParts: Array<Array<number>> = [];
        let writeCounter = 0;

        // Add a null to represent a byte of 0 to the end of the parts array
        labelParts.push(null);

        // Convert each part to a byte array
        labelParts.forEach(label => {
            const byteArray: Array<number> = [];

            // Handle the end of the array
            if (label === null)
                WriteUInt8(byteArray, 0);
            else
                WriteString(byteArray, label);

            encodedParts.push(byteArray);
        });

        Trace({ labelParts, encodedParts: JSON.stringify(encodedParts) }, { logName: `dns` });

        // For compression purposes, compare to the existing array
        // Each encoded part will be preceded by a length value of 1 byte
        // Compare the entire label, and then compare each subseqent string dropping the inital part until there is a match
        const messageHex = ToHexadecimal(Uint8Array.from(message)).join(``);
        let hasMatch = false;

        Dev({ [`Current message for compression check`]: messageHex }, { logName: `dns` });

        do {
            // Ignore the ending null byte when checking for prior matches
            if (encodedParts.length > 1) {
                // Encode as hexadecimal to utilize string matching
                let labelHex = ``;

                encodedParts.forEach((encodedLabel, idx) => {
                    // For the end null value, simply write the value
                    if (idx == (encodedParts.length - 1))
                        labelHex += encodedLabel[0].toString(16).padStart(2, `0`);
                    else {
                        // Add the encoded length
                        labelHex += encodedLabel.length.toString(16).padStart(2, `0`);

                        // Add each hexadecimal letter
                        labelHex += encodedLabel.map(characterCode => characterCode.toString(16).padStart(2, `0`)).join(``);
                    }
                });

                // Check the message for a match
                Dev({ [`Checking ${encodedParts.length - 1} parts for compression`]: labelHex }, { logName: `dns` });
                const findMatch = messageHex.search(new RegExp(labelHex));
                Dev({ findMatch }, { logName: `dns` });

                hasMatch = (findMatch >= 0);

                Dev(`Compression match ${hasMatch ? `` : `NOT `}found`);

                // If the section matches, write 16 bits: "11" followed by the location in the string
                if (hasMatch) {
                    const matchBinary = `11${(findMatch / 2).toString(2).padStart(14, `0`)}`;
                    BinaryToNumberArray(matchBinary, 2).forEach(byteValue => message.push(byteValue));
                    writeCounter += 2;

                    // Remove the rest of the encodedParts
                    encodedParts.splice(0);
                }
                // If no match is found, write the first encoded part, and try again
                else {
                    const writeLabelPart = encodedParts.shift();
                    WriteUInt8(message, writeLabelPart.length);
                    writeCounter += (1 + writeLabelPart.length);
                    writeLabelPart.forEach(label => message.push(label));
                }
            }
            else
                // Write the ending byte
                encodedParts.shift().forEach(label => {
                    message.push(label);
                    writeCounter++;
                });
        } while (!hasMatch && (encodedParts.length > 0));

        return writeCounter;
    }
}

export {
    ResourceRecord,
};
