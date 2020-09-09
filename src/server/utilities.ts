import { IReadBinaryValue, IReadBinaryValueToString } from "../interfaces/server";

/** Read arbitrary numbers of bytes from a typed array, and update the offset */
function readBytes(typedArray: Uint8Array, startingOffset: number, byteCount = 1): IReadBinaryValue {
    const newOffset = startingOffset + byteCount,
        values = typedArray.subarray(startingOffset, newOffset);

    return { value: octetsToValue(values), offsetAfterRead: newOffset };
}

function readUInt8(typedArray: Uint8Array, offset: number): IReadBinaryValue {
    return readBytes(typedArray, offset);
}

function readUInt16(typedArray: Uint8Array, offset: number): IReadBinaryValue {
    return readBytes(typedArray, offset, 2);
}

function readUInt32(typedArray: Uint8Array, offset: number): IReadBinaryValue {
    return readBytes(typedArray, offset, 4);
}

function readString(typedArray: Uint8Array, offset: number, byteCount, format: BufferEncoding = `utf8` ): IReadBinaryValueToString {
    // Get the subset of the array to read as a string
    const newOffset = offset + byteCount,
        data = typedArray.subarray(offset, newOffset);

    // Convert the data into the desired string type array
    const stringData: Array<string> = [];

    switch (format) {
        case `hex`:
            data.forEach(val => {
                stringData.push(val.toString(16).padStart(2, `0`));
            });
            break;

        case `utf8`:
        case `utf-8`:
            // Fill the string array based on the character code
            stringData.splice(0, 0, String.fromCharCode(...data));
            break;

        default: {
            const err = new Error(`No implementation for "${format}" strings exists`);
            err.name = `NOT IMPLEMENTED`;
            throw err;
        }
    }

    // The return string needs all null values removed
    const returnString = stringData.join(``).replace(/\0/g, ``);

    return { value: returnString, offsetAfterRead: newOffset };
}

function readIpAddress(typedArray: Uint8Array, offset: number): IReadBinaryValueToString {
    const { value, offsetAfterRead } = readUInt32(typedArray, offset);

    return { value: valueToOctets(value, 4).join(`.`), offsetAfterRead };
}

function octetsToValue(octets: Uint8Array): number {
    // Convert to a hexadecimal string using .forEach as Uint8Array.map() returns another typed array
    const hexValues: Array<string> = [];
    octets.forEach(value => {
        hexValues.push(value.toString(16).padStart(2, `0`));
    });

    // Convert to a number from the joined string
    return parseInt(hexValues.join(``), 16);
}

function valueToOctets(value: number, expectedOctets = 0): Uint8Array {
    // Convert the number to hex
    let strHex = value.toString(16);

    // Make sure values that can be less than the octets * 256 have enough hexadecimal digits
    if (expectedOctets > 0)
        strHex = strHex.padStart(expectedOctets * 2, `0`);

    // Split into 2-character values representing 2 bytes
    const hexValues = strHex.match(/../g);

    // Convert to a numerical array
    const numberValues = hexValues.map(hex => parseInt(hex, 16));

    // Return as Uint8Array
    return Uint8Array.from(numberValues);
}

function macAddressFromHex(hexadecimalString: string): string {
    return hexadecimalString.match(/../g).join(`:`);
}

function hexValueFromMacAddress(macAddress: string): string {
    return macAddress.split(`:`).join(``);
}

export {
    octetsToValue as OctetsToNumber,
    valueToOctets as NumberToOctets,
    macAddressFromHex as MACAddressFromHex,
    hexValueFromMacAddress as HexFromMACAddress,
    readUInt8 as ReadUInt8,
    readUInt16 as ReadUInt16,
    readUInt32 as ReadUInt32,
    readIpAddress as ReadIPAddress,
    readString as ReadString,
};
