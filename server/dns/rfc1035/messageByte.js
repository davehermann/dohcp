let _uInt8Value = new WeakMap();

class MessageByte {
    constructor(value, format = `decimal`) {
        // Convert to a decimal value
        let decimalValue;
        switch (format) {
            case `decimal`:
                decimalValue = value;
                break;

            case `hex`:
                decimalValue = parseInt(value, 16);
                break;

            case `binary`:
                decimalValue = parseInt(value, 2);
                break;
        }

        _uInt8Value.set(this, decimalValue);
    }

    get decimal() { return _uInt8Value.get(this); }
    get hexadecimal() { return this.decimal.toString(16).padStart(2, `0`); }
    get binary() { return this.decimal.toString(2).padStart(8, `0`); }

    toJSON() {
        return {
            decimal: this.decimal,
            hexadecimal: this.hexadecimal,
            binary: this.binary,
        };
    }
}

module.exports.MessageByte = MessageByte;
