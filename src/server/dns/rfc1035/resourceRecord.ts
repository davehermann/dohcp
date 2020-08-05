// NPM Modules
import { Dev, Trace } from "multi-level-logger";

// Application Modules
import { MessageByte, WriteBytes } from "./MessageByte";
import { eDnsClass, eDnsType, ILabel, eMessageByteComponent } from "../../../interfaces/configuration/dns";

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
    static DecodeLabel(messageArray: Array<MessageByte>, offset: number): ILabel {
        const labelData: Array<string> = [];
        let labelLength: number;

        do {
            // Check the first two bits for a value of "11"
            if (messageArray[offset].binary.substr(0, 2) == `11`) {
                const labelOffset = parseInt(messageArray.slice(offset, offset + 2).map(m => { return m.binary; }).join(``).substr(2), 2);
                const { value: label } = ResourceRecord.DecodeLabel(messageArray, labelOffset);
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

                    label = String.fromCharCode.apply(this, messageArray.slice(offset, offset + labelLength).map(d => d.decimal));
                    labelData.push(label);

                    offset += labelLength;
                }
            }
        } while (labelLength != 0);

        return { value: labelData.join(`.`), offset };
    }

    /** Encode a label into a DNS message */
    static EncodeLabel(message: Array<MessageByte>, label: string): number {
        // Split the label
        const labelParts = label.split(`.`),
            encodedParts: Array<Array<MessageByte>> = [];
        let writeCounter = 0;

        // Add a null to represent a byte of 0 to the end of the parts array
        labelParts.push(null);

        // Convert each part to a byte array
        labelParts.forEach(label => {
            const byteArray: Array<MessageByte> = [];

            // Handle the end of the array
            if (label === null)
                WriteBytes(byteArray, 1, 0);
            else
                WriteBytes(byteArray, label.length, label, eMessageByteComponent.string);

            encodedParts.push(byteArray);
        });

        Trace({ labelParts, encodedParts }, { logName: `dns` });

        // For compression purposes, compare to the existing array
        // Each encoded part will be preceded by a length value of 1 byte
        // Compare the entire label, and then compare each subseqent string dropping the inital part until there is a match
        const messageHex = message.map(element => element.hexadecimal).join(``);
        let hasMatch = false;

        Dev({ [`Current message`]: messageHex }, { logName: `dns` });

        do {
            // Ignore the ending null byte when checking for prior matches
            if (encodedParts.length > 1) {
                let labelHex = ``;

                encodedParts.forEach((encodedLabel, idx) => {
                    // For the end null value, simply write the value
                    if (idx == (encodedParts.length - 1))
                        labelHex += encodedLabel[0].hexadecimal;
                    else {
                        // Add the encoded length
                        labelHex += encodedLabel.length.toString(16).padStart(2, `0`);

                        // Add each hexadecimal letter
                        labelHex += encodedLabel.map(letter => letter.hexadecimal).join(``);
                    }
                });

                // Check the message for a match
                Trace({ [`Checking ${encodedParts.length - 1} parts`]: labelHex }, { logName: `dns` });
                const findMatch = messageHex.search(new RegExp(labelHex));
                Dev({ findMatch }, { logName: `dns` });

                hasMatch = (findMatch >= 0);

                // If the section matches, write 16 bits: "11" followed by the location in the string
                if (hasMatch) {
                    const matchBinary = `11${(findMatch / 2).toString(2).padStart(14, `0`)}`;
                    WriteBytes(message, 2, matchBinary, eMessageByteComponent.binary);
                    writeCounter += 2;

                    // Remove the rest of the encodedParts
                    encodedParts.splice(0);
                }
                // If no match is found, write the first encoded part, and try again
                else {
                    const writeLabelPart = encodedParts.shift();
                    WriteBytes(message, 1, writeLabelPart.length);
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
