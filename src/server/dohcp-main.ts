// NPM Modules
import { Debug, Err } from "multi-level-logger";

// Application Modules
import { LoadConfiguration } from "./configuration";
import { DataServer } from "./control/server";
import { DHCPServer } from "./dhcp/dhcp-main";
import { DNSServer } from "./dns/dns-main";

async function initialize() {
    const configuration = await LoadConfiguration();

    Debug({ [`Active configuration`]: configuration });

    if (!!configuration.dns && !configuration.dns.disabled)
        await DNSServer(configuration);

    const dhcpServer = new DHCPServer(configuration);
    await dhcpServer.Start();

    const dataServer = new DataServer(configuration, dhcpServer);
    await dataServer.Start();
}

initialize()
    .catch(err => {
        // Catch any uncaught errors
        Err(err, { asIs: true });
    });
