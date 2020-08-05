// NPM Modules
import { Debug, Err } from "multi-level-logger";

// Application Modules
import { LoadConfiguration } from "./configuration";
import { DataServer } from "./control/server";
import { DNSServer } from "./dns/dns-main";

async function initialize() {
    const configuration = await LoadConfiguration();

    Debug({ [`Active configuration`]: configuration });

    if (!!configuration.dns && !configuration.dns.disabled)
        await DNSServer(configuration);

    await DataServer(configuration);
}

initialize()
    .catch(err => {
        // Catch any uncaught errors
        Err(err, { asIs: true });
    });
