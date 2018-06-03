let _clientIdentification = new WeakMap(),
    _expirationTime = new WeakMap(),
    _ipAddress = new WeakMap(),
    _isConfirmed = new WeakMap(),
    _messageId = new WeakMap(),
    _providedHostname = new WeakMap(),
    _staticHostname = new WeakMap();

class AllocatedAddress {
    constructor(clientId, confirmAddress) {
        _clientIdentification.set(this, clientId);

        // By default, the address is offered, but not assigned
        _isConfirmed.set(this, confirmAddress || false);
        this.ipAddress = null;
        this.providedHost = null;
        this.staticHost = null;
    }

    get clientId() { return _clientIdentification.get(this).uniqueId; }

    set ipAddress(val) { _ipAddress.set(this, val); }
    get ipAddress() { return _ipAddress.get(this); }

    get lastMessageId() { return _messageId.get(this); }
    set lastMessageId(val) { _messageId.set(this, val); }

    get leaseExpirationTimestamp() { return _expirationTime.get(this); }

    set providedHost(val) { _providedHostname.set(this, val); }
    set staticHost(val) { _staticHostname.set(this, val); }

    get hostname() {
        if (!!_staticHostname.get(this))
            return _staticHostname.get(this);

        return _providedHostname.get(this);
    }

    get isConfirmed() { return _isConfirmed.get(this); }

    ConfirmAddress() {
        _isConfirmed.set(this, true);
        _messageId.set(this, null);
    }

    SetExpiration(currentTime, leaseSeconds) {
        _expirationTime.set(this, currentTime.getTime() + (leaseSeconds * 1000));
    }

    toJSON() {
        return {
            clientId: this.clientId,
            ipAddress: this.ipAddress,
            isConfirmed: this.isConfirmed,
            providedHost: _providedHostname.get(this),
            staticHost: _staticHostname.get(this),
        };
    }
}

module.exports.AllocatedAddress = AllocatedAddress;
