import { IReadBinaryValue, IReadBinaryValueToString } from "../interfaces/server";

/**
 * Read arbitrary numbers of bytes from a typed array, and update the offset
 * @param typedArray - Array to read from
 * @param startingOffset - Starting block
 * @param byteCount - Number of blocks to read _(Default: **1**)_
 */
function readBytes(typedArray: Uint8Array | Array<number>, startingOffset: number, byteCount = 1): IReadBinaryValue {
    const newOffset = startingOffset + byteCount,
        values = Uint8Array.from(typedArray).subarray(startingOffset, newOffset);

    return { value: octetsToValue(values), offsetAfterRead: newOffset };
}

/**
 * Read a single data block from a Uint8Array
 * @param typedArray - Array to read from
 * @param offset - Starting block
 */
function readUInt8(typedArray: Uint8Array | Array<number>, offset: number): IReadBinaryValue {
    return readBytes(typedArray, offset);
}

/**
 * Read 2 data blocks from a Uint8Array
 * @param typedArray - Array to read from
 * @param offset - Starting block
 */
function readUInt16(typedArray: Uint8Array | Array<number>, offset: number): IReadBinaryValue {
    return readBytes(typedArray, offset, 2);
}

/**
 * Read 4 data blocks from a Uint8Array
 * @param typedArray - Array to read from
 * @param offset - Starting block
 */
function readUInt32(typedArray: Uint8Array | Array<number>, offset: number): IReadBinaryValue {
    return readBytes(typedArray, offset, 4);
}

/**
 * Read string data out of a Uint8Array
 * @param typedArray - Array to read from
 * @param offset - Starting block
 * @param byteCount - Number of blocks to read
 * @param format - Format string for reading data blocks into
 */
function readString(typedArray: Uint8Array | Array<number>, offset: number, byteCount: number, format: BufferEncoding = `utf8` ): IReadBinaryValueToString {
    // Get the subset of the array to read as a string
    const newOffset = offset + byteCount,
        data = Uint8Array.from(typedArray).subarray(offset, newOffset);

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

/**
 * Read an IP address out of a typed array
 * @param typedArray - Array to read from
 * @param offset - Starting block
 */
function readIpAddress(typedArray: Uint8Array | Array<number>, offset: number): IReadBinaryValueToString {
    const { value, offsetAfterRead } = readUInt32(typedArray, offset);

    return { value: valueToOctets(value, 4).join(`.`), offsetAfterRead };
}

/**
 * TypeGuard for determining if a value is a number or a number array
 * @param data - value to check the type of
 */
function isNumber(data: number | Array<number>): data is number {
    return (data as Array<number>).length === undefined;
}

/**
 * Write arbitrary numbers of bytes to a typed array
 * @param dataArray - Array to write to
 * @param data - Data blocks to write into the array
 * @param offset - Starting data block
 *   + _(Defaults to adding to the end of the array)_
 * @param byteCount - Number of blocks to write _(Default: **1**)_
 */
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

/**
 * Write a single data block to a Uint8Array
 * @param dataArray - Array to write to
 * @param data - Data blocks to write into the array
 * @param offset - Starting data block
 *   + _(Defaults to adding to the end of the array)_
 */
function writeUInt8(dataArray: Array<number>, data: number, offset = -1): void {
    // Add a single byte to the array
    writeBytes(dataArray, data, offset);
}

/**
 * Write 2 data blocks to a Uint8Array
 * @param dataArray - Array to write to
 * @param data - Data blocks to write into the array
 * @param offset - Starting data block
 *   + _(Defaults to adding to the end of the array)_
 */
function writeUInt16(dataArray: Array<number>, data: number, offset = -1): void {
    writeBytes(dataArray, data, offset, 2);
}

/**
 * Write 4 data blocks to a Uint8Array
 * @param dataArray - Array to write to
 * @param data - Data blocks to write into the array
 * @param offset - Starting data block
 *   + _(Defaults to adding to the end of the array)_
 */
function writeUInt32(dataArray: Array<number>, data: number, offset = -1): void {
    writeBytes(dataArray, data, offset, 4);
}

/**
 * Write string data to a Uint8Array
 * @param dataArray - Array to write to
 * @param data - Data blocks to write into the array
 * @param offset - Starting data block
 *   + _(Defaults to adding to the end of the array)_
 * @param byteCount - Number of blocks to write
 * @param format - Format string to convert the data from
 */
function writeString(dataArray: Array<number>, data: string, offset = -1, byteCount = -1, format: BufferEncoding = `utf8`): void {
    // Use an empty string for null/undefined values
    data = data || ``;

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

/**
 * Write an IP address to a typed array
 * @param dataArray - Array to write to
 * @param data - Data blocks to write into the array
 * @param offset - Starting data block
 *   + _(Defaults to adding to the end of the array)_
 */
function writeIpAddress(dataArray: Array<number>, data: string, offset = -1): void {
    const ip = Uint8Array.from(data.split(`.`).map(strOctet => +strOctet));
    writeUInt32(dataArray, octetsToValue(ip));
}

/**
 * Convert byte data to a hexadecimal string
 * @param octets - The Uint8Array data
 */
function octetsToValue(octets: Uint8Array): number {
    // Convert to a hexadecimal string using .forEach as Uint8Array.map() returns another typed array
    const hexValues = toHexadecimal(octets);

    // Convert to a number from the joined string
    return parseInt(hexValues.join(``), 16);
}

/**
 * Convert any numerical value into a Uint8Array representation of that value
 * @param value - Number to convert
 * @param expectedOctets - Expected number of bytes in the Uint8Array
 */
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

/** Convert a hexadecimal string into a colon (:)-separated string of 2-byte values */
function macAddressFromHex(hexadecimalString: string): string {
    return hexadecimalString.match(/../g).join(`:`);
}

/** Convert a colon-separated string of 2-byte values into a hexadecimal string with no separator */
function hexValueFromMacAddress(macAddress: string): string {
    return macAddress.split(`:`).join(``);
}

/** Convert a Uint8Array into a hexadecimal string representation */
function toHexadecimal(octets: Uint8Array = new Uint8Array()): Array<string> {
    const hex: Array<string> = [];

    octets.forEach(oc => {
        hex.push(oc.toString(16).padStart(2, `0`));
    });

    return hex;
}

/**
 * Convert a typed array to an array of numbers
 */
function convertTypedArrayToNumbers(originalArray: Uint8Array | Uint16Array | Uint32Array): Array<number> {
    const numberArray: Array<number> = [];

    for (let offset = 0, total = originalArray.length; offset < total; offset++)
        numberArray.push(originalArray[offset]);

    return numberArray;
}

function convertBinaryToNumbers(binaryString: string, totalBytes = 1): Array<number> {
    binaryString = binaryString.padStart(totalBytes * 8, `0`);

    // Separate into each 8-bit byte
    const binaryArray = binaryString.match(/......../g);

    // Add each byte to the array
    return binaryArray.map(byteString => parseInt(byteString, 2));
}

export {
    convertTypedArrayToNumbers as ConvertTypeArrayToNumberArray,
    convertBinaryToNumbers as BinaryToNumberArray,
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
