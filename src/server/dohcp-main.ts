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

    if (!!configuration.dhcp && !configuration.dhcp.disabled)
        await DHCPServer(configuration);

    await DataServer(configuration);
}

initialize()
    .catch(err => {
        // Catch any uncaught errors
        Err(err, { asIs: true });
    });
