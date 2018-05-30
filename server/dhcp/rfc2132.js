// Options are defined by RFC 2132

// Application modules
const { MACAddressFromHex, ReadIpAddress, ReadString, ReadUInt8, ReadUInt16 } = require(`./utilities`),
    { Dev, Trace, Warn } = require(`../logging`);
// JSON data
const rawOptionDefinition = require(`./rfc2132.json`);

let optionDefinition = {};
rawOptionDefinition.forEach(opt => {
    let nameParts = opt.name.split(` `);
    nameParts[0] = nameParts[0].toLowerCase();
    opt.propertyName = nameParts.join(``);

    optionDefinition[opt.code] = opt;
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

        let option = optionDefinition[optionCode];

        // Get the length field, which will be the next octect unless explicitly defined as not existing
        if (!option || !option.noLength)
            ({ value: optionLength, offset} = ReadUInt8(buf, offset));

        // If the option is the end-of-options code, we can end all processing
        if (!!option && option.isEnd)
            break;

        // If the option is the pad code, we can move forward one octet
        else if (!!option && option.isPad)
            offset++;

        // With an option, get the value and transform as per the settings
        else if (!!option) {
            let value = null;
            if (!!option.decode) {
                let method = null,
                    args = [buf, offset];

                if (typeof option.decode == `object`) {
                    method = option.decode.method;

                    if (!!option.decode.args)
                        option.decode.args.forEach(arg => {
                            if (arg == `optionLength`)
                                arg = optionLength;

                            args.push(arg);
                        });
                } else
                    method = option.decode;

                // Any arguments that need to be sent to the decode method must be explicitly passed
                Dev({ name: option.name, method, args: args.slice(1) });
                let rawValue, action;
                switch (method) {
                    case `ReadUInt8`:
                        action = ReadUInt8;
                        break;
                    case `ReadUInt16`:
                        action = ReadUInt16;
                        break;
                    case `ReadString`:
                        action = ReadString;
                        break;
                    case `ReadIpAddress`:
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

    Trace({ optionLengths });

    return options;
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
                    matchingOption = optionDefinition[code];

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

module.exports.ParseOptions = parseOptions;
