import { eMessageByteComponent, IMessageByte } from "../../../interfaces/configuration/dns";

class MessageByte {
    constructor(value: string | number, format: eMessageByteComponent = eMessageByteComponent.decimal) {
        // Convert to a decimal value
        let decimalValue;
        switch (format) {
            case eMessageByteComponent.decimal:
                decimalValue = value;
                break;

            case eMessageByteComponent.hexadecimal:
                decimalValue = parseInt((value as string), 16);
                break;

            case eMessageByteComponent.binary:
                decimalValue = parseInt((value as string), 2);
                break;
        }

        this.uInt8Value = decimalValue;
    }

    private uInt8Value: number;

    get decimal(): number { return this.uInt8Value; }
    get hexadecimal(): string { return this.decimal.toString(16).padStart(2, `0`); }
    get binary(): string { return this.decimal.toString(2).padStart(8, `0`); }

    toJSON(): IMessageByte {
        return {
            decimal: this.decimal,
            hexadecimal: this.hexadecimal,
            binary: this.binary,
        };
    }
}

/**
 * Write data as MessageByte array to message
 * @param message - Existing message
 * @param numberOfBytes - Byte count to be written
 * @param data - Data to convert and write
 * @param format - Format of the existing input
 */
function writeBytes(message: Array<MessageByte>, numberOfBytes: number, data: number | string, format: eMessageByteComponent = eMessageByteComponent.decimal): void {
    // Convert the data to binary
    let binaryValue: string;
    switch (format) {
        case eMessageByteComponent.decimal:
            binaryValue = data.toString(2).padStart(numberOfBytes * 8, `0`);
            break;

        case eMessageByteComponent.hexadecimal:
            binaryValue = parseInt((data as string), 16).toString(2).padStart(numberOfBytes * 8, `0`);
            break;

        case eMessageByteComponent.binary:
            binaryValue = (data as string).padStart(numberOfBytes * 8, `0`);
            break;

        case eMessageByteComponent.string: {
            const binArray: Array<string> = [];
            for (let idx = 0; idx < (data as string).length; idx++)
                binArray.push((data as string).charCodeAt(idx).toString(2).padStart(8, `0`));

            binaryValue = binArray.join(``);
        }
            break;
    }

    // Separate into each 8-bit byte
    const binaryArray = binaryValue.match(/......../g);

    // Add each byte to the array
    binaryArray.forEach(value => {
        message.push(new MessageByte(value, eMessageByteComponent.binary));
    });
}

export {
    MessageByte,
    writeBytes as WriteBytes
};
