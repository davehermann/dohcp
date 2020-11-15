// NPM Modules
import { Dev, Warn } from "multi-level-logger";

// Application Modules
import { DefineOptions } from "./options/optionDefinitions";
import { ReadUInt8, ReadIPAddress, ReadString, ReadUInt16, ReadUInt32,
    MACAddressFromHex, ToHexadecimal,
    WriteUInt8, WriteUInt16, WriteUInt32, WriteString, WriteIPAddress } from "../../utilities";
import { RootOption, encodingTypes } from "./options/rootOption";
import { hardwareTypes } from "../dhcpMessage";
import { IClientIdentifier, IRequestedParameter } from "../../../interfaces/configuration/dhcp";

type OptionValue = string | number | IClientIdentifier | Array<IRequestedParameter>;

const optionDefinition = DefineOptions();

class DhcpOptions {
    constructor(private readonly message: Uint8Array, private readonly optionsOffset: number) {
        this.parse();
    }

    //#region Private properties

    private readonly optionData: Uint8Array = this.message.subarray(this.optionsOffset);

    //#endregion Private properties

    //#region Public properties

    public readonly options: Map<string, OptionValue> = new Map();

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
                let value: OptionValue = null;

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

                let rawValue: OptionValue,
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

                // As a number of options require additional parsing, the value goes through the extra parser
                value = this.optionDecoder(option, rawValue);
                Dev({ rawValue, value }, { logName: `dhcp` });

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

    private encodingParser(option: RootOption, args: Array<Array<number> | string | number>, optionLength?: number) {
        const method = option.encoding.method;

        if (!!option.encoding.args)
            option.encoding.args.forEach(arg => {
                if ((optionLength !== undefined) && (optionLength !== null) && (arg === `optionLength`))
                    arg = `` + optionLength;

                args.push(arg);
            });

        return { method, args };
    }

    private optionDecoder(option: RootOption, rawValue: OptionValue): OptionValue {
        let value: OptionValue = null;

        switch (option.propertyName) {
            case `clientIdentifier`:
                value = this.decodeClientIdentifier((rawValue as string));
                break;

            case `dhcpMessageType`:
                value = option.valueMap.get((rawValue as number).toString());
                break;

            case `parameterRequestList`: {
                // This is a list of codes

                const requestedParameters: Array<IRequestedParameter> = [];
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

    private optionEncoder(option: RootOption, decodedValue: OptionValue): OptionValue {
        let value: OptionValue = null;

        switch (option.propertyName) {
            case `clientIdentifier`:
                value = (decodedValue as IClientIdentifier).uniqueId;
                break;

            case `dhcpMessageType`:
                // Get the numerical ID for the message type string
                for (const [prop, val] of option.valueMap.entries())
                    if (val == decodedValue) {
                        value = +prop;
                        break;
                    }
                break;

            case `parameterRequestList`: {
                const paramList = (decodedValue as Array<IRequestedParameter>).map(param => param.code);
                value = ToHexadecimal(Uint8Array.from(paramList)).join(``);
            }
                break;

            default:
                value = decodedValue;
        }

        return value;
    }

    // rawValue is the hexadecimal type plus the ID
    private decodeClientIdentifier(rawValue: string): IClientIdentifier {
        if ((rawValue === undefined) || (rawValue === null))
            return null;

        const id: IClientIdentifier = { uniqueId: rawValue };

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

    Encode(encodedMessage: Array<number>): void {
        for (const [propertyName, value] of this.options.entries()) {
            const option = optionDefinition.byProperty.get(propertyName),
                optionValue = this.optionEncoder(option, value);
            const { method, args } = this.encodingParser(option, [encodedMessage, `optionValue`, `offset`]);
            let optionLength = option.length;

            // Set the option length, if length is used
            if (optionLength !== undefined) {
                // A value of -1 means length needs to be calculated
                if (optionLength < 0) {
                    optionLength = 0;
                    const valueList = option.encoding.isArray ? optionValue : [optionValue];

                    (valueList as Array<OptionValue>).forEach(itemValue => {
                        switch (method) {
                            case encodingTypes.IPAddress:
                                optionLength += 4;
                                break;

                            case encodingTypes.String:
                                optionLength += (args[args.length - 1] == `hex`) ? ((itemValue as string).length / 2) : (itemValue as string).length;
                                break;
                        }
                    });
                }

                // Replace optionLength in args array
                const idxArgLength = args.indexOf(`optionLength`);
                if (idxArgLength >= 0)
                    args.splice(idxArgLength, 1, optionLength);
            }

            Dev({ propertyName, option, method, optionLength, args: args.slice(1) }, { logName: `dhcp` });

            // Add the code
            WriteUInt8(encodedMessage, option.code);

            // Add the length, if a length is required
            if (optionLength !== undefined)
                WriteUInt8(encodedMessage, optionLength);

            // Add a decoded value
            let action: (dataArray: Array<number>, data: number | string) => void;
            switch (method) {
                case encodingTypes.UInt8:
                    action = WriteUInt8;
                    break;
                case encodingTypes.UInt16:
                    action = WriteUInt16;
                    break;
                case encodingTypes.UInt32:
                    action = WriteUInt32;
                    break;
                case encodingTypes.String:
                    action = WriteString;
                    break;
                case encodingTypes.IPAddress:
                    action = WriteIPAddress;
                    break;
            }

            const valueArray = option.encoding.isArray ? optionValue : [optionValue];
            Dev({ valueArray }, { logName: `dhcp` });

            (valueArray as Array<OptionValue>).forEach(itemValue => {
                const argList = args.map(arg => {
                    switch (arg) {
                        case `offset`:
                            return encodedMessage.length;
                            break;
                        case `optionValue`:
                            return itemValue;
                            break;

                        default:
                            return arg;
                    }
                });

                Dev({ argList: argList.slice(1) }, { logName: `dhcp` });
                action.apply(action, argList);
            });
        }

        WriteUInt8(encodedMessage, optionDefinition.byProperty.get(`endOption`).code);
    }

    EnsureClientIdentifierExists(clientHardwareAddress: string, hardwareType: hardwareTypes): void {
        // Default to the chaddr address
        if (!this.options.has(`clientIdentifier`) || !!clientHardwareAddress) {
            const rawValue = hardwareType.toString(16).padStart(2, `0`) + clientHardwareAddress.replace(/:/g, ``);

            this.options.set(`clientIdentifier`, this.decodeClientIdentifier(rawValue));
        }
    }

    toJSON(): unknown {
        const data = [];
        for (const [name, value] of this.options.entries())
            data.push({ name, value });

        return {
            hex: ToHexadecimal(this.optionData).join(``),
            options: data,
        };
    }

    //#endregion Public methods
}

export {
    DhcpOptions as DHCPOptions,
};
