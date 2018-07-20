// Application modules
const { DHCPMessage } = require(`../../server/dhcp/dhcpMessage`);

function decodeDhcpMessage(action) {
    let rawDhcpMessage = action.additionalArguments[0],
        message = new DHCPMessage();

    message.Decode(Buffer.from(rawDhcpMessage, `hex`));

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ message }, null, 4));
}

module.exports.DHCPDecode = decodeDhcpMessage;
