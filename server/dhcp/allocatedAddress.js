let _clientIdentification = new WeakMap(),
    _ipAddress = new WeakMap(),
    _isConfirmed = new WeakMap(),
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

    set ipAddress(val) { _ipAddress.set(this, val); }
    set providedHost(val) { _providedHostname.set(this, val); }
    set staticHost(val) { _staticHostname.set(this, val); }

    get hostname() {
        if (!!_staticHostname.get(this))
            return _staticHostname.get(this);

        return _providedHostname.get(this);
    }
}

module.exports.AllocatedAddress = AllocatedAddress;
