module.exports.MACAddressFromHex = (hexString) => {
    let newAddress = [],
        idx = 0;

    while (idx < hexString.length) {
        newAddress.push(hexString[idx] + hexString[idx + 1]);
        idx += 2;
    }

    return newAddress.join(`:`);
};
