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
            stringData.splice(0, 0, ...toHexadecimal(data));
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

function isNumber(data: number | Array<number>): data is number {
    return (data as Array<number>).length === undefined;
}

function writeBytes(dataArray: Array<number>, data: number | Array<number>, offset: number, byteCount = 1) {
    let octets: Uint8Array;

    if (isNumber(data))
        octets = valueToOctets(data, byteCount);
    else
        octets = Uint8Array.from(data);

    if (offset < 0)
        offset = dataArray.length;

    for (let idx = 0; idx < octets.length; idx++)
        dataArray[offset + idx] = octets[idx];
}

function writeUInt8(dataArray: Array<number>, data: number, offset = -1): void {
    // Add a single byte to the array
    writeBytes(dataArray, data, offset);
}

function writeUInt16(dataArray: Array<number>, data: number, offset = -1): void {
    writeBytes(dataArray, data, offset, 2);
}

function writeUInt32(dataArray: Array<number>, data: number, offset = -1): void {
    writeBytes(dataArray, data, offset, 4);
}

function writeString(dataArray: Array<number>, data: string, offset = -1, byteCount = -1, format: BufferEncoding = `utf8`): void {
    // Convert the string into a useable array based on the format
    const stringData: Array<number> = [];

    switch (format) {
        case `hex`: {
            const hexArray = data.match(/../g);
            stringData.splice(0, 0, ...hexArray.map(val => parseInt(val, 16)));
        }
            break;

        case `utf8`:
            for (let idx = 0; idx < data.length; idx++)
                stringData.push(data.charCodeAt(idx));
            break;

        default: {
            const err = new Error(`No implementation for "${format}" strings exists`);
            err.name = `NOT IMPLEMENTED`;
            throw err;
        }
    }

    if (byteCount > -1)
        while(stringData.length < byteCount)
            stringData.push(0);

    writeBytes(dataArray, stringData, offset);
}

function writeIpAddress(dataArray: Array<number>, data: string, offset = -1): void {
    const ip = Uint8Array.from(data.split(`.`).map(strOctet => +strOctet));
    writeUInt32(dataArray, octetsToValue(ip));
}

function octetsToValue(octets: Uint8Array): number {
    // Convert to a hexadecimal string using .forEach as Uint8Array.map() returns another typed array
    const hexValues = toHexadecimal(octets);

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

function toHexadecimal(octets: Uint8Array): Array<string> {
    const hex: Array<string> = [];

    octets.forEach(oc => {
        hex.push(oc.toString(16).padStart(2, `0`));
    });

    return hex;
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
    toHexadecimal as ToHexadecimal,
    writeUInt8 as WriteUInt8,
    writeUInt16 as WriteUInt16,
    writeUInt32 as WriteUInt32,
    writeIpAddress as WriteIPAddress,
    writeString as WriteString,
};
