// NPM Modules
import { Dev, Warn } from "multi-level-logger";

// Application Modules
import { DefineOptions } from "./options/optionDefinitions";
import { ReadUInt8, ReadIPAddress, ReadString, ReadUInt16, ReadUInt32, MACAddressFromHex } from "../../utilities";
import { RootOption, encodingTypes } from "./options/rootOption";
import { hardwareTypes } from "../dhcpMessage";

const optionDefinition = DefineOptions();

class DhcpOptions {
    constructor(private readonly message: Uint8Array, private readonly optionsOffset: number) {
        this.parse();
    }

    //#region Private properties

    private readonly optionData: Uint8Array = this.message.subarray(this.optionsOffset);

    //#endregion Private properties

    //#region Public properties

    public readonly options: Map<string, string | number> = new Map();

    //#endregion Public properties

    //#region Private methods

    private parse() {
        let offset = 0;

        // Each option will be defined by a code octect
        // Many specify the length (in octets) of the data
        while (offset < this.optionData.length) {
            let optionCode,
                optionLength = null;

            // Get the option code
            ({ value: optionCode, offsetAfterRead: offset } = ReadUInt8(this.optionData, offset));

            // Get the option definition
            let option: RootOption;
            if (optionDefinition.byCode.has(optionCode))
                option = optionDefinition.byCode.get(optionCode);

            // Get the option length: if we didn't find an option definition, we'll be skipping the length of the option
            if (!option || !!option.length)
                ({ value: optionLength, offsetAfterRead: offset } = ReadUInt8(this.optionData, offset));

            // If the option is the end-of-options code, we can end all processing
            if (!!option && option.isEnd)
                break;
            else if (!!option && option.isPad)
                // Move one value for a pad
                offset++;
            else if (!!option && !!option.encoding) {
                let value: number | string = null;

                const passedArguments: Array<unknown> = [this.optionData, offset];

                option.encoding.args.forEach(arg => {
                    if (
                        (
                            (optionLength !== undefined)
                            && (optionLength !== null)
                        )
                        && (arg == `optionLength`)
                    )
                        arg = optionLength;

                    passedArguments.push(arg);
                });

                Dev({ name: option.name, method: option.encoding.method, args: passedArguments.slice(1) }, { logName: `dhcp` });

                let rawValue: number | string,
                    // eslint-disable-next-line @typescript-eslint/ban-types
                    action: Function;

                switch (option.encoding.method) {
                    case encodingTypes.IPAddress:
                        action = ReadIPAddress;
                        break;

                    case encodingTypes.String:
                        action = ReadString;
                        break;

                    case encodingTypes.UInt8:
                        action = ReadUInt8;
                        break;

                    case encodingTypes.UInt16:
                        action = ReadUInt16;
                        break;

                    case encodingTypes.UInt32:
                        action = ReadUInt32;
                        break;
                }

                ({ value: rawValue, offsetAfterRead: offset } = action.apply(action, passedArguments));
                Dev({ rawValue }, { logName: `dhcp` });

                // As a number of options require additional parsing, the value goes through the extra parser
                value = this.optionDecoder(option, rawValue);

                this.options.set(option.propertyName, value);
            } else {
                // No option means the option code didn't match a known option.
                // Just advance offset by length, and warn on the missing code

                // Report the code if no option is found
                if (!option)
                    Warn(`DHCP option not found: ${optionCode}`, { logName: `dhcp` });

                // Skip the length
                offset += optionLength;
            }
        }
    }

    private optionDecoder(option: RootOption, rawValue: number | string): number | string {
        let value = null;

        switch (option.propertyName) {
            case `clientIdentifier`:
                value = this.decodeClientIdentifier(rawValue);
                break;

            case `dhcpMessageType`:
                value = option.valueMap[rawValue];
                break;

            case `parameterRequestList`: {
                // This is a list of codes

                const requestedParameters = [];
                while ((rawValue as string).length > 0) {
                    const code = parseInt((rawValue as string).substr(0, 2), 16);

                    if (optionDefinition.byCode.has(code))
                        requestedParameters.push({ code, name: optionDefinition.byCode.get(code).name });
                    else
                        Warn(`Parameter request list option not found: ${code}`, { logName: `dhcp` });

                    rawValue = (rawValue as string).substr(2);
                }

                value = requestedParameters;
            }
                break;

            default:
                value = rawValue;
        }

        return value;
    }

    // rawValue is the hexadecimal type plus the ID
    private decodeClientIdentifier(rawValue) {
        if ((rawValue === undefined) || (rawValue === null))
            return null;

        const id = { uniqueId: rawValue, type: null, address: null };

        // An ethernet address should be parsed
        const type = parseInt(rawValue.substr(0, 2), 16);
        // Type 1 is ethernet
        if ((type == hardwareTypes.ethernet) && (rawValue.length == 14)) {
            id.type = `Ethernet MAC`;
            id.address = MACAddressFromHex(rawValue.substr(2));
        }

        return id;
    }

    //#endregion Private methods

    //#region Public methods

    toJSON(): unknown {
        const hex = [];
        this.optionData.forEach(val => {
            hex.push(val.toString(16).padStart(2, `0`));
        });

        const data = [];
        for (const [name, value] of this.options.entries())
            data.push({ name, value });

        return {
            hex: hex.join(``),
            options: data,
        };
    }

    //#endregion Public methods
}

export {
    DhcpOptions as DHCPOptions,
};
