let _history = {};

function clientHistory(clientId) {
    return _history[clientId];
}

function getClientId(dhcpMessage) {
    let clientId = dhcpMessage.chaddr;
    if (((dhcpMessage.htype !== undefined) && (dhcpMessage.htype !== null)) && (dhcpMessage.htype !== 1))
        clientId += `_${dhcpMessage.htype.toString(16).padStart(2, `0`)}`;

    return clientId;
}

function addEvent(clientId, data) {
    if (!_history[clientId])
        _history[clientId] = [];

    // Only store a maximum of 200 events
    if (_history[clientId].length > 200)
        _history[clientId].shift();

    data.ts = new Date();

    _history[clientId].push(data);
}

function addDhcpMessage(dhcpRequest, dhcpResponse) {
    let clientId = getClientId(dhcpRequest);

    addEvent(clientId, { dhcpRequest, dhcpResponse });
    /*
    addEvent(clientId, { dhcpMessage: { type: dhcpMessage.options.dhcpMessageType } });
    */
}

function addDhcpAssignment(dhcpMessage, assignedAddress, hostnameFromDns) {
    let clientId = getClientId(dhcpMessage);

    addEvent(clientId, { address: assignedAddress.ipAddress, hostnameFromDns });
}

module.exports.DhcpClientHistory = clientHistory;
module.exports.HistoryMessage = addDhcpMessage;
module.exports.HistoryAssignment = addDhcpAssignment;
