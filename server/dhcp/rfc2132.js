// Options are defined by RFC 2132

// Application modules
const { MACAddressFromHex,
        ReadIpAddress, ReadString, ReadUInt8, ReadUInt16, ReadUInt32,
        WriteIpAddress, WriteString, WriteUInt8, WriteUInt16, WriteUInt32 } = require(`./utilities`),
    { Dev, Warn } = require(`../logging`);
// JSON data
const rawOptionDefinition = require(`./rfc2132.json`);

let optionDefinition = { byCode: {}, byProperty: {} };
rawOptionDefinition.forEach(opt => {
    if (!opt.propertyName) {
        let nameParts = opt.name.split(` `);
        nameParts[0] = nameParts[0].toLowerCase();
        opt.propertyName = nameParts.join(``);
    }

    optionDefinition.byCode[opt.code] = opt;
    optionDefinition.byProperty[opt.propertyName] = opt;
});

function parseOptions(buf, offset) {
    Dev({ [`Options Hexadecimal`]: buf.toString(`hex`, offset) });

    let options = {},
        // For debugging
        optionLengths = {};

    // Each option will be defined by a code octect
    // Many specify the length (in octets) of the data

    while (offset < buf.length) {
        let optionCode,
            optionLength = null;

        // Get the option code
        ({ value: optionCode, offset } = ReadUInt8(buf, offset));

        let option = optionDefinition.byCode[optionCode];

        // Get the length field, which will be the next octect unless explicitly defined as not existing
        if (!option || !!option.length)
            ({ value: optionLength, offset} = ReadUInt8(buf, offset));

        // If the option is the end-of-options code, we can end all processing
        if (!!option && option.isEnd)
            break;

        // If the option is the pad code, we can move forward one octet
        else if (!!option && option.isPad)
            offset++;

        // With an option, get the value and transform as per the settings
        else if (!!option && !!option.encoding) {
            let value = null;

            if (!!option.encoding) {
                let args = [buf, offset],
                    method = encodingParser(option, args, optionLength);

                // Any arguments that need to be sent to the decode method must be explicitly passed
                Dev({ name: option.name, method, args: args.slice(1) });
                let rawValue, action;
                switch (method) {
                    case `UInt8`:
                        action = ReadUInt8;
                        break;
                    case `UInt16`:
                        action = ReadUInt16;
                        break;
                    case `UInt32`:
                        action = ReadUInt32;
                        break;
                    case `String`:
                        action = ReadString;
                        break;
                    case `IpAddress`:
                        action = ReadIpAddress;
                        break;
                }
                ({ value: rawValue, offset} = action.apply(action, args));
                Dev({ rawValue });

                // As a number of options require additional parsing, the value goes through the extra parser
                value = optionDecoder(option, rawValue);
            }

            options[option.propertyName] = value;

            // For debugging
            optionLengths[option.propertyName] = optionLength;
        }

        // No option means the option code didn't match a known option.
        // Just advance offset by length, and warn on the missing code
        else {
            // Skip the length, and report the code
            Warn(`Option not found: ${optionCode}`);
            offset += optionLength;
        }
    }

    Dev({ optionLengths });

    return options;
}

function encodeOptions(buf, options, offset) {
    for (let propertyName in options) {
        let optionDef = optionDefinition.byProperty[propertyName],
            optionValue = optionEncoder(optionDef, options[propertyName]),
            args = [buf, `optionValue`, `offset`],
            method = encodingParser(optionDef, args),
            isArray = (typeof optionDef.encoding == `object`) && optionDef.encoding.isArray,
            optionLength = optionDef.length;

        // Set the option length if used
        if (optionLength !== undefined) {
            // -1 means the length is not defined and will be calculated
            if (optionLength < 0) {
                optionLength = 0;
                let valueList = isArray ? optionValue : [optionValue];

                valueList.forEach(itemValue => {
                    switch (method) {
                        case `IpAddress`:
                            optionLength += 4;
                            break;

                        case `String`:
                            if (args[args.length - 1] == `hex`)
                                optionLength += itemValue.length / 2;
                            else
                                optionLength += itemValue.length;
                            break;
                    }
                });
            }

            // Replace optionLength in args array
            args = args.map(arg => { return (arg == `optionLength`) ? optionLength : arg; });
        }

        Dev({ propertyName, optionDef, method, optionLength, offset, args: args.slice(1) });

        // Add the code
        offset = WriteUInt8(buf, optionDef.code, offset);
        Dev({ offset });

        // Add the length, if one is required
        if (optionLength !== undefined)
            offset = WriteUInt8(buf, optionLength, offset);
        Dev({ offset });

        // Add a decoded value
        let action;
        switch (method) {
            case `UInt8`:
                action = WriteUInt8;
                break;
            case `UInt16`:
                action = WriteUInt16;
                break;
            case `UInt32`:
                action = WriteUInt32;
                break;
            case `String`:
                action = WriteString;
                break;
            case `IpAddress`:
                action = WriteIpAddress;
                break;
        }

        // Replace offset in args array
        let valueArray = isArray ? optionValue : [optionValue];
        valueArray.forEach(itemValue => {
            let argList = args.map(arg => {
                switch (arg) {
                    case `offset`:
                        return offset;
                    case `optionValue`:
                        return itemValue;
                    default:
                        return arg;
                }
            });
            offset = action.apply(action, argList);
        });
        Dev({ offset });
    }

    // Write an end option
    offset = WriteUInt8(buf, optionDefinition.byProperty[`endOption`].code, offset);
}

function optionDecoder(option, rawValue) {
    let value = null;

    switch (option.propertyName) {
        case `clientIdentifier`: {
            let id = { uniqueId: rawValue };

            // An ethernet address should be parsed
            let type = parseInt(rawValue.substr(0, 2), 16);
            // Type 1 is ethernet
            if ((type == 1) && (rawValue.length == 14)) {
                id.type = `Ethernet MAC`;
                id.address = MACAddressFromHex(rawValue.substr(2));
            }

            value = id;
        }
            break;

        case `dhcpMessageType`:
            value = option.valueMap[rawValue];
            break;

        case `parameterRequestList`: {
            // This is a list of codes

            let requestedParameters = [];
            while (rawValue.length > 0) {
                let code = parseInt(rawValue.substr(0, 2), 16),
                    matchingOption = optionDefinition.byCode[code];

                if (!!matchingOption)
                    requestedParameters.push({ code, name: matchingOption.name });
                else
                    Warn(`Option not found: ${code}`);

                rawValue = rawValue.substr(2);
            }

            value = requestedParameters;
        }
            break;

        default:
            value = rawValue;
            break;
    }

    return value;
}

function optionEncoder(option, decodedValue) {
    let value = null;

    switch (option.propertyName) {
        case `clientIdentifier`:
            value = decodedValue.uniqueId;
            break;

        case `dhcpMessageType`:
            for (let id in option.valueMap)
                if (option.valueMap[id] == decodedValue) {
                    value = +id;
                    break;
                }
            break;

        case `parameterRequestList`:
            value = ``;

            decodedValue.forEach(opt => {
                value += opt.code.toString(16).padStart(2, `0`);
            });
            break;

        default:
            value = decodedValue;
            break;
    }

    return value;
}

function encodingParser(option, args, optionLength) {
    let method = null;

    if (typeof option.encoding == `object`) {
        method = option.encoding.method;

        if (!!option.encoding.args)
            option.encoding.args.forEach(arg => {
                if (!!optionLength && (arg == `optionLength`))
                    arg = optionLength;

                args.push(arg);
            });
    } else
        method = option.encoding;

    return method;
}

module.exports.DHCPOptions = optionDefinition;
module.exports.ParseOptions = parseOptions;
module.exports.EncodeOptions = encodeOptions;
