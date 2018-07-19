// Application modules
const { Warn } = require(`../logging`);

const REMOVAL_TIME = 30;

let deregistrations = {};

function trackDeregistration(dhcpRequestMessage) {
    let tracking = {
        timestamp: new Date(),
        xid: dhcpRequestMessage.xid,
        clientId: dhcpRequestMessage.chaddr,
        hostname: dhcpRequestMessage.options.hostNameOption,
        vendorId: dhcpRequestMessage.options.vendorClassIdentifier,
    };

    let thisTrack = deregistrations[tracking.clientId];
    if (!thisTrack) {
        thisTrack = { tracks: [], removeId: null };
        deregistrations[tracking.clientId] = thisTrack;
    }

    if (!!thisTrack.removeId)
        clearTimeout(thisTrack.removeId);

    if (thisTrack.tracks.length > 0) {
        let message = `Client not resetting on DHCPNAK`;
        message += ` (${thisTrack.tracks.length} time${thisTrack.tracks.length !== 1 ? `s` : ``})`;
        message += `: ${tracking.clientId}`;

        if (!!tracking.hostname)
            message += ` - host: ${tracking.hostname}`;
        else if (!!tracking.vendorId)
            message += ` - vendor: ${tracking.vendorId}`;

        Warn(message, `dhcp`);
    }

    thisTrack.tracks.push(tracking);

    thisTrack.removeId = setTimeout(() => { delete deregistrations[tracking.clientId]; }, REMOVAL_TIME * 1000);
}

module.exports.TrackDeregistration = trackDeregistration;
