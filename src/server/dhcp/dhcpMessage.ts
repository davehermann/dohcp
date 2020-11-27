import {
    MACAddressFromHex,
    ReadUInt8, ReadUInt32, ReadUInt16, ReadIPAddress, ReadString, WriteUInt8, ToHexadecimal, WriteUInt32, WriteUInt16, WriteIPAddress, HexFromMACAddress, WriteString,
} from "../utilities";
import { IReadBinaryValueToString } from "../../interfaces/server";
import { DHCPOptions, OptionsDefinition as DHCPOptionsDefinition } from "./rfc2132/dhcpOptions";
import { IClientIdentifier, IRequestedParameter } from "../../interfaces/configuration/dhcp";
import { AllocatedAddress } from "./allocation/AllocatedAddress";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { Dev } from "multi-level-logger";

const MAGIC_COOKIE = Uint8Array.from([99, 130, 83, 99]);

/** Hardware address types */
enum hardwareTypes {
    ethernet = 1,
}

/** Operation types */
enum operationTypes {
    BOOTREQUEST = 1,
    BOOTREPLY = 2,
}

class Message {
    //#region Private properties

    /** Operation type: request or reply */
    private op: operationTypes;
    /** Is this DHCP message a reply */
    private set isReply (val: boolean) { this.op = (val ? operationTypes.BOOTREPLY : operationTypes.BOOTREQUEST); }

    /** Hardware address type (1 for ethernet) */
    private htype: hardwareTypes;

    /**
     * Hardware address identifier length
     *   - MAC address for ethernet
     */
    private hlen: number;

    /** Number of hops for BOOTP message (0 for direct from client) */
    private hops: number;

    /** Unique identifier generated by client */
    private xid: number;

    /** Client-generated seconds elapsed since client began address acquisition or renewal process */
    private secs: number;

    /** Broadcast flag, most of which is reserved for future usage */
    private flags: number;

    /** Client existing IP - Only non-zero for clients in BOUND/RENEW/REBINDING state */
    private ciaddr: string;

    /** [Y]our (server-assigned to client) IP address */
    private yiaddr: string;

    /** IP of the next server to use, in DHCPOFFER and DHCPACK */
    private siaddr: string;

    /** Relay agent IP address (Used for booting via a relay) */
    private giaddr: string;

    /** Client hardware address (e.g. Ethernet MAC) */
    private chaddr: string;

    /** Server host name (optional) */
    private sname: string;

    /**
     * Boot file name
     *   - "generic" or *null* in **DHCPDISCOVER**
     *   - fully qualified directory-path in **DHCPOFFER**
     */
    private file: string;

    /**
     * Magic cookie is defined in the RFC for beginning the options field
     *   - It's **always** [99, 130, 83, 99]
     */
    private magicCookie: Uint8Array;
    /** This formalizes the options as DHCP as opposed to underlying BOOTP vendor codes */
    private get isDhcpMessage(): boolean {
        let messageIsDHCP = !!this.magicCookie && (this.magicCookie.length == MAGIC_COOKIE.length);

        // Check the value against the Magic Cookie
        if (messageIsDHCP)
            MAGIC_COOKIE.forEach((value, idx) => {
                if (!!this.magicCookie && (value !== this.magicCookie[idx]))
                    messageIsDHCP = false;
            });

        return messageIsDHCP;
    }

    /** DHCP Options */
    private options: DHCPOptions;

    /** Binary encoded version of the message */
    private binaryMessage: Uint8Array = new Uint8Array();

    //#endregion Private properties

    //#region Public properties

    /** The CHADDR field provided by the client */
    public get clientHardwareAddress(): string { return this.chaddr; }

    /** The CHADDR field, plus an additional identifier if the hardware type isn't ethernet */
    public get clientHardwareIdentifier(): string {
        let clientId = this.chaddr;

        if ((this.htype !== undefined) && (this.htype !== null) && (this.htype !== hardwareTypes.ethernet))
            clientId += `_${ToHexadecimal(Uint8Array.from([this.htype]))}`;

        return clientId;
    }

    /**
     *  Client's unique identifier
     *
     * @remarks
     * Typically the hardware address of the client
     */
    public get clientIdentifier(): IClientIdentifier {
        if (!!this.options) {
            const clientId: IClientIdentifier = this.options.options.get(`clientIdentifier`) as IClientIdentifier;

            if (!!clientId)
                return clientId;
        }

        return null;
    }

    /** Existing IP address for a client (CIADDR for the message) */
    public get clientExistingIP(): string { return this.ciaddr; }

    /** Client-generated XID for the message */
    public get clientMessageId(): number { return this.xid; }

    /** Hostname provided from the client */
    public get clientProvidedHostname(): string {
        if (!!this.options.options.get(`hostNameOption`))
            return this.options.options.get(`hostNameOption`) as string;

        return null;
    }

    /**
     * The DHCP Message Type, by its name
     *
     * @remarks
     * Possible values
     *   + DHCPDISCOVER
     *   + DHCPOFFER
     *   + DHCPREQUEST
     *   + DHCPDECLINE
     *   + DHCPACK
     *   + DHCPNAK
     *   + DHCPRELEASE
     *   + DHCPINFORM
     */
    public get messageType(): string {
        if (!!this.options)
            return this.options.options.get(`dhcpMessageType`) as string;

        return null;
    }

    /** Parameter request list coming from the client's message */
    public get parameterRequestList(): Array<IRequestedParameter> {
        if (!!this.options)
            return (this.options.options.get(`parameterRequestList`) as Array<IRequestedParameter>);

        return null;
    }

    /** Client-requested IP from the options list */
    public get requestedIP(): string {
        if (!!this.options)
            return (this.options.options.get(`requestedIPAddress`) as string);

        return null;
    }

    /** Server IP that the client is responding to, from the options list */
    public get serverIdentifier(): string {
        if (!!this.options)
            return (this.options.options.get(`serverIdentifier`) as string);

        return null;
    }

    /** Vendor class identifier, from the options list */
    public get vendorClassIdentifier(): string {
        if (!!this.options)
            return (this.options.options.get(`vendorClassIdentifier`) as string);

        return null;
    }

    /** The raw Uint8Array data blocks representation of this message */
    public get asData(): Uint8Array {
        return this.binaryMessage;
    }

    //#endregion Public properties

    //#region Private methods

    private readHardwareAddress(message: Uint8Array, offset: number): IReadBinaryValueToString {
        const { value, offsetAfterRead } = ReadString(message, offset, 16, `hex`);
        let address: string;

        // This is hardcoded to expect MAC addresses
        switch (this.htype) {
            case hardwareTypes.ethernet:
                address = MACAddressFromHex(value.substr(0, this.hlen * 2));
                break;

            default:
                throw new Error(`Expected hardware address type of 1, but received ${this.htype}`);
        }

        return { value: address, offsetAfterRead };
    }

    private writeHardwareAddress(encodedMessage: Array<number>): void {
        const addressAsHexadecimal = HexFromMACAddress(this.chaddr);

        WriteString(encodedMessage, addressAsHexadecimal, undefined, 16, `hex`);
    }

    private readMagicCookie(message: Uint8Array, offset: number) {
        const newOffset = offset + 4,
            vendorIdCookie = message.subarray(offset, newOffset);

        return { value: vendorIdCookie, offsetAfterRead: newOffset };
    }

    private writeMagicCookie(encodedMessage: Array<number>): void {
        if (!this.magicCookie)
            this.magicCookie = MAGIC_COOKIE;

        encodedMessage.splice(encodedMessage.length, 0, ...this.magicCookie);
    }

    //#endregion Private methods

    //#region  Public methods

    public Decode(message: Uint8Array): void {
        // Set the initial offset, which will be modified on every read
        let offset = 0;

        ({ value: this.op, offsetAfterRead: offset } = ReadUInt8(message, offset));
        ({ value: this.htype, offsetAfterRead: offset } = ReadUInt8(message, offset));
        ({ value: this.hlen, offsetAfterRead: offset } = ReadUInt8(message, offset));
        ({ value: this.hops, offsetAfterRead: offset } = ReadUInt8(message, offset));
        ({ value: this.xid, offsetAfterRead: offset } = ReadUInt32(message, offset));
        ({ value: this.secs, offsetAfterRead: offset } = ReadUInt16(message, offset));
        ({ value: this.flags, offsetAfterRead: offset } = ReadUInt16(message, offset));
        ({ value: this.ciaddr, offsetAfterRead: offset } = ReadIPAddress(message, offset));
        ({ value: this.yiaddr, offsetAfterRead: offset } = ReadIPAddress(message, offset));
        ({ value: this.siaddr, offsetAfterRead: offset } = ReadIPAddress(message, offset));
        ({ value: this.giaddr, offsetAfterRead: offset } = ReadIPAddress(message, offset));
        ({ value: this.chaddr, offsetAfterRead: offset} = this.readHardwareAddress(message, offset));
        ({ value: this.sname, offsetAfterRead: offset } = ReadString(message, offset, 64));
        ({ value: this.file, offsetAfterRead: offset } = ReadString(message, offset, 128));
        ({ value: this.magicCookie, offsetAfterRead: offset } = this.readMagicCookie(message, offset));

        // As options are the last component of a message, the returned offset isn't needed
        this.options = new DHCPOptions(message, offset);

        // Guarantee a client identifier exists in the options
        this.options.EnsureClientIdentifierExists(this.chaddr, this.htype);
    }

    public Encode(): void {
        const encodedMessage: Array<number> = [];

        WriteUInt8(encodedMessage, this.op);
        WriteUInt8(encodedMessage, this.htype);
        WriteUInt8(encodedMessage, this.hlen);
        WriteUInt8(encodedMessage, this.hops);
        WriteUInt32(encodedMessage, this.xid);
        WriteUInt16(encodedMessage, this.secs);
        WriteUInt16(encodedMessage, this.flags);
        WriteIPAddress(encodedMessage, this.ciaddr);
        WriteIPAddress(encodedMessage, this.yiaddr);
        WriteIPAddress(encodedMessage, this.siaddr);
        WriteIPAddress(encodedMessage, this.giaddr);
        this.writeHardwareAddress(encodedMessage);
        WriteString(encodedMessage, this.sname, undefined, 64);
        WriteString(encodedMessage, this.file, undefined, 128);
        this.writeMagicCookie(encodedMessage);

        // As options are the last component of a message, we don't need the offset back
        this.options.Encode(encodedMessage);

        // End with a single null (0) byte
        let idxLastDataByte = encodedMessage.length - 1;
        while (encodedMessage[idxLastDataByte] === 0)
            idxLastDataByte--;
        const finalMessage: Array<number> = encodedMessage.slice(0, idxLastDataByte + 1);
        finalMessage.push(0);

        this.binaryMessage = Uint8Array.from(finalMessage);
    }

    /** Create a reply to a DHCP Request message */
    public GenerateReply(requestMessage: Message, assignedAddress: AllocatedAddress, configuration: IConfiguration, messageType: string): void {
        this.isReply = true;
        this.htype = requestMessage.htype;
        this.hlen = requestMessage.hlen;
        this.hops = requestMessage.hops;
        this.xid = requestMessage.xid;
        this.secs = requestMessage.secs;
        this.flags = requestMessage.flags;
        this.ciaddr = `0.0.0.0`;
        this.yiaddr = assignedAddress.ipAddress;
        // The IP address of this server
        this.siaddr = configuration.serverIpAddress || `0.0.0.0`;
        // Relays are ignored
        this.giaddr = `0.0.0.0`;
        this.chaddr = requestMessage.chaddr;
        // Don't provide a hostname for this server
        this.sname = null;
        // Don't provide a boot file path
        this.file = null;

        // Specify the codes for the parameters the server will include as part of the response
        const serverDefinedParameters = [
            `dhcpMessageType`,
            `serverIdentifier`,
            `ipAddressLeaseTime`,
            `renewalTimeValue`,
            `rebindingTimeValue`
        ];

        const parametersForResponse = serverDefinedParameters.map(propertyName => DHCPOptionsDefinition.byProperty.get(propertyName));

        Dev({ parametersForResponse }, { logName: `dhcp` });
        // Supply the requested parameters
        if (!!requestMessage.parameterRequestList)
            requestMessage.parameterRequestList.forEach(param => {
                Dev({ param }, { logName: `dhcp` });
                if (!parametersForResponse.find(p => (p.code == param.code)))
                    parametersForResponse.push(DHCPOptionsDefinition.byCode.get(param.code));
            });

        this.options = new DHCPOptions();
        this.options.FillParameters(parametersForResponse, configuration, assignedAddress, messageType, this.siaddr);
    }

    public toString(format: BufferEncoding = `hex`): string {
        switch (format) {
            case `hex`:
                return ToHexadecimal(this.binaryMessage).join(``);
                break;
        }
    }

    public toJSON(): unknown {
        return {
            op: this.op,
            htype: this.htype,
            hlen: this.hlen,
            hops: this.hops,
            xid: this.xid,
            secs: this.secs,
            flags: this.flags,
            ciaddr: this.ciaddr,
            yiaddr: this.yiaddr,
            siaddr: this.siaddr,
            giaddr: this.giaddr,
            chaddr: this.chaddr,
            sname: this.sname,
            file: this.file,
            magicCookie: this.magicCookie,
            isDhcpMessage: this.isDhcpMessage,
            options: this.options,
        };
    }

    //#endregion Public methods
}

export {
    hardwareTypes,
    Message as DHCPMessage,
};