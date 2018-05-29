// Options are defined by RFC 2132

// Application modules
const { MACAddressFromHex } = require(`./utilities`),
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

function parseOptions(currentMessage, _offset) {
    Trace({ [`Options Hexadecimal`]: currentMessage.message.toString(`hex`, _offset.get(currentMessage)) });

    let options = {},
        // For debugging
        optionLengths = {};

    // Each option will be defined by a code octect
    // Many specify the length (in octets) of the data

    while (_offset.get(currentMessage) < currentMessage.message.length) {
        let optionCode = currentMessage._readUInt8();

        let option = optionDefinition[optionCode],
            optionLength = null;

        // Get the length field, which will be the next octect unless explicitly defined as not existing
        if (!option || !option.noLength)
            optionLength = currentMessage._readUInt8();

        // If the option is the end-of-options code, we can end all processing
        if (!!option && option.isEnd)
            break;

        // If the option is the pad code, we can move forward one octet
        else if (!!option && option.isPad)
            _offset.set(currentMessage, _offset.get(currentMessage) + 1);

        // With an option, get the value and transform as per the settings
        else if (!!option) {
            let value = null;
            if (!!option.decode) {
                let method = null,
                    args = null;

                if (typeof option.decode == `object`) {
                    method = option.decode.method;

                    if (!!option.decode.args)
                        args = option.decode.args.map(arg => {
                            if (arg == `optionLength`)
                                return optionLength;

                            return arg;
                        });
                } else
                    method = option.decode;

                // Any arguments that need to be sent to the decode method must be explicitly passed
                Dev({ args });
                let rawValue = currentMessage[method].apply(currentMessage, args);
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
            _offset.set(currentMessage, _offset.get(currentMessage) + optionLength);

            Warn(`Option not found: ${optionCode}`);
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
