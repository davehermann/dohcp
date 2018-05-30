function macAddressFromHex(hexString) {
    let newAddress = [],
        idx = 0;

    while (idx < hexString.length) {
        newAddress.push(hexString[idx] + hexString[idx + 1]);
        idx += 2;
    }

    return newAddress.join(`:`);
}

function readString(buf, offset, lengthInOctets, format = `utf8`) {
    let value = buf.toString(format, offset, offset + lengthInOctets).replace(/\0/g, ``);
    return {
        value: (value.length > 0) ? value : null,
        offset: offset + lengthInOctets
    };
}

function readUInt8(buf, offset) {
    return { value: buf.readUInt8(offset), offset: offset + 1 };
}

function readUInt16(buf, offset) {
    return { value: buf.readUInt16BE(offset), offset: offset + 2 };
}

function readUInt32(buf, offset) {
    return { value: buf.readUInt32BE(offset), offset: offset + 4 };
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

module.exports.MACAddressFromHex = macAddressFromHex;
module.exports.ReadString = readString;
module.exports.ReadUInt8 = readUInt8;
module.exports.ReadUInt16 = readUInt16;
module.exports.ReadUInt32 = readUInt32;
module.exports.ReadIpAddress = readIpAddress;
