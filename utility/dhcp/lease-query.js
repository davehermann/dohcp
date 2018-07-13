// Node/NPM modules
const http = require(`http`);

function queryLeases(action, allActions, configuration) {
    let urlPath = `/dhcp/leases`,
        title = `Active DHCP Leases`;

    if (action.additionalArguments.indexOf(`--all-known`) >= 0) {
        urlPath += `/all`;
        title = `All Active, Previously Assigned, and Future-configured DHCP leases`;
    } else if (action.additionalArguments.indexOf(`--previously-seen`) >= 0) {
        urlPath += `/previous`;
        title = `All Active and Previously Assigned DHCP Leases`;
    } else if (action.additionalArguments.indexOf(`--active`) >= 0) {
        urlPath += `/active`;
    }

    http.get(
        {
            host: configuration.dataServiceHost,
            port: 45332,
            path: urlPath,
        },
        (res) => {
            let data = ``;
            res.on(`data`, (chunk) => {
                data += chunk;
            });

            res.on(`end`, () => {
                let dhcpData = JSON.parse(data);

                // console.log(dhcpData.leaseData);

                // eslint-disable-next-line no-console
                console.log(`\n----- ${title} -----\n`);

                if (dhcpData.leaseData.length == 0)
                    // eslint-disable-next-line no-console
                    console.log(`No leases found`);
                else {
                    let display = [],
                        currentTime = (new Date()).getTime();
                    dhcpData.leaseData.forEach(lease => {
                        let clientIdType = parseInt(lease.clientId.substr(0, 2), 16),
                            clientId = lease.clientId.substr(2);

                        switch (clientIdType) {
                            case 1:
                                clientId = clientId.match(/../g).join(`:`);
                                break;
                        }

                        let detail = `${lease.ipAddress}: ${clientId}`;
                        let hostname = lease.staticHost || lease.providedHost;
                        if (!!hostname)
                            detail += ` (${hostname})`;

                        if (!!lease.leaseStart) {
                            let expirationTime = lease.leaseStart + (dhcpData.configuration.dhcp.leases.pool.leaseSeconds * 1000),
                                timeToExpiration = Math.round((expirationTime - currentTime) / 1000);

                            detail += (timeToExpiration > 0) ? ` expires in ${timeToExpiration} seconds` : ` lease expired`;
                        }

                        display.push(detail);
                    });

                    if (!!dhcpData.otherData) {
                        display.push(`\n   -- Configured Assignments --`);

                        dhcpData.otherData.sort((a, b) => { return a.ip < b.ip ? -1 : 1; });

                        dhcpData.otherData.forEach(lease => {
                            let clientIdType = parseInt(lease.clientId.substr(0, 2), 16),
                                clientId = lease.clientId.substr(2);

                            switch (clientIdType) {
                                case 1:
                                    clientId = clientId.match(/../g).join(`:`);
                                    break;
                            }

                            let detail = `${lease.ip}: ${clientId}`;

                            // Check for static assignment
                            let staticAssignment = dhcpData.configuration.dhcp.leases.static[clientId];

                            if (!!staticAssignment) {
                                detail += ` **STATIC**`;

                                if (!!staticAssignment.hostname)
                                    detail += ` (${staticAssignment.hostname})`;
                            }

                            display.push(detail);
                        });
                    }

                    if (action.additionalArguments.indexOf(`--all-known`) >= 0) {
                        // Display the static assignments
                        display.push(`\n   -- Static Assignments --`);

                        let staticHosts = [];
                        for (let mac in dhcpData.configuration.dhcp.leases.static) {
                            let data = dhcpData.configuration.dhcp.leases.static[mac];

                            data.clientId = mac;

                            staticHosts.push(data);
                        }

                        staticHosts.sort((a, b) => { return a.ip < b.ip ? -1 : 1; });

                        staticHosts.forEach(lease => {
                            let detail = `${lease.ip}: ${lease.clientId}`;

                            if (!!lease.hostname)
                                detail += ` (${lease.hostname})`;

                            display.push(detail);
                        });
                    }

                    // eslint-disable-next-line no-console
                    console.log(display.join(`\n`));
                    // eslint-disable-next-line no-console
                    console.log();
                }
            });
        }
    );
}

module.exports.DHCPLeases = queryLeases;
