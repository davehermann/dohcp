function macAddressFromHex(hexString) {
    let newAddress = [],
        idx = 0;

    while (idx < hexString.length) {
        newAddress.push(hexString[idx] + hexString[idx + 1]);
        idx += 2;
    }

    return newAddress.join(`:`);
}
function hexFromMacAddress(macAddress) {
    let octets = macAddress.split(`:`);
    return octets.join(``);
}

function readString(buf, offset, lengthInOctets, format = `utf8`) {
    let value = buf.toString(format, offset, offset + lengthInOctets).replace(/\0/g, ``);
    return {
        value: (value.length > 0) ? value : null,
        offset: offset + lengthInOctets
    };
}
function writeString(buf, data, offset, lengthInOctets, format = `utf8`) {
    buf.write(data || ``, offset, lengthInOctets, format);
    return offset + lengthInOctets;
}

function readUInt8(buf, offset) {
    return { value: buf.readUInt8(offset), offset: offset + 1 };
}
function writeUInt8(buf, data, offset) {
    buf.writeUInt8(data, offset);
    return offset + 1;
}

function readUInt16(buf, offset) {
    return { value: buf.readUInt16BE(offset), offset: offset + 2 };
}
function writeUInt16(buf, data, offset) {
    buf.writeUInt16BE(data, offset);
    return offset + 2;
}

function readUInt32(buf, offset) {
    return { value: buf.readUInt32BE(offset), offset: offset + 4 };
}
function writeUInt32(buf, data, offset) {
    buf.writeUInt32BE(data, offset);
    return offset + 4;
}

function readIpAddress(buf, offset) {
    let ip = [];
    for (let idx = 0; idx < 4; idx++) {
        let value;
        ({ value, offset } = readUInt8(buf, offset));
        ip.push(value);
    }
    return { value: ip.join(`.`), offset };
}
function writeIpAddress(buf, data, offset) {
    let ip = data.split(`.`);
    ip.forEach(octet => { offset = writeUInt8(buf, octet, offset); });
    return offset;
}

function toBinary(msg) {
    // msg can be a buffer or hexadecimal string
    let decodeMessage = (msg instanceof Buffer) ? msg : Buffer.from(msg, `hex`),
        asBinaryString = [],
        offset = 0;

    while (offset < decodeMessage.length) {
        let decimalValue;
        ({ value: decimalValue, offset } = readUInt8(decodeMessage, offset));

        asBinaryString.push(decimalValue.toString(2).padStart(8, `0`));
    }
    return asBinaryString;
}

module.exports.MACAddressFromHex = macAddressFromHex;
module.exports.HexFromMACAddress = hexFromMacAddress;
module.exports.ReadIpAddress = readIpAddress;
module.exports.ReadString = readString;
module.exports.ReadUInt8 = readUInt8;
module.exports.ReadUInt16 = readUInt16;
module.exports.ReadUInt32 = readUInt32;
module.exports.WriteIpAddress = writeIpAddress;
module.exports.WriteString = writeString;
module.exports.WriteUInt8 = writeUInt8;
module.exports.WriteUInt16 = writeUInt16;
module.exports.WriteUInt32 = writeUInt32;

module.exports.ToBinary = toBinary;
