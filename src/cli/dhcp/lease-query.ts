// Node Modules
import { get as HttpGet } from "http";

// Application Modules
import { IAction, IActionToTake } from "../../interfaces/configuration/cliArguments";
import { IConfiguration } from "../../interfaces/configuration/configurationFile";
import { AllocatedAddress } from "../../server/dhcp/allocation/AllocatedAddress";

function queryLeases(action: IActionToTake, allActions: Map<string, IAction>, configuration: IConfiguration): Promise<void> {
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

    return new Promise(resolve => {
        HttpGet(
            {
                host: configuration.dataServiceHost,
                port: 45332,
                path: urlPath,
            },
            res => {
                let data = ``;
                res.on(`data`, (chunk) => {
                    data += chunk;
                });

                res.on(`end`, () => {
                    const dhcpData = JSON.parse(data);

                    if (dhcpData.disabled)
                        // eslint-disable-next-line no-console
                        console.log(`\nThe DHCP service is not enabled\n`);
                    else {
                        // console.log(dhcpData.leaseData);

                        // eslint-disable-next-line no-console
                        console.log(`\n----- ${title} -----\n`);

                        const leaseDetail = (dhcpData.leaseData as Array<AllocatedAddress>);

                        if (leaseDetail.length == 0)
                            // eslint-disable-next-line no-console
                            console.log(`No leases found`);
                        else {
                            const display = [],
                                currentTime = (new Date()).getTime();

                            leaseDetail.forEach(lease => {
                                const clientIdType = parseInt(lease.clientId.substr(0, 2), 16);
                                let clientId = lease.clientId.substr(2);

                                switch (clientIdType) {
                                    case 1:
                                        clientId = clientId.match(/../g).join(`:`);
                                        break;
                                }

                                let detail = `${lease.ipAddress}: ${clientId}`;
                                const hostname = lease.staticHost || lease.providedHost;
                                if (!!hostname)
                                    detail += ` (${hostname})`;

                                if (!!lease.leaseStart) {
                                    const expirationTime = lease.leaseStart + (configuration.dhcp.leases.pool.leaseSeconds * 1000),
                                        timeToExpiration = Math.round((expirationTime - currentTime) / 1000);

                                    detail += (timeToExpiration > 0) ? ` expires in ${timeToExpiration} seconds` : ` lease expired`;
                                }

                                display.push(detail);
                            });

                            if (!!dhcpData.otherData) {
                                display.push(`\n   -- Configured Assignments --`);

                                dhcpData.otherData.sort((a, b) => { return a.ip < b.ip ? -1 : 1; });

                                dhcpData.otherData.forEach(lease => {
                                    const clientIdType = parseInt(lease.clientId.substr(0, 2), 16);
                                    let clientId = lease.clientId.substr(2);

                                    switch (clientIdType) {
                                        case 1:
                                            clientId = clientId.match(/../g).join(`:`);
                                            break;
                                    }

                                    let detail = `${lease.ip}: ${clientId}`;

                                    // Check for static assignment
                                    const staticAssignment = dhcpData.configuration.dhcp.leases.static[clientId];

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

                                const staticHosts = [];
                                for (const mac in dhcpData.configuration.dhcp.leases.static) {
                                    const data = dhcpData.configuration.dhcp.leases.static[mac];

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
                    }

                    resolve();
                });
            }
        );
    });
}

export {
    queryLeases as QueryLeases,
};
