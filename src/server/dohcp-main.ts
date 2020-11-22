// NPM Modules
import { Debug, Err } from "multi-level-logger";

// Application Modules
import { LoadConfiguration } from "./configuration";
import { DataServer } from "./control/server";
import { DHCPServer } from "./dhcp/dhcp-main";
import { DNSServer } from "./dns/dns-main";
import { ClientHistory } from "./history/history";
import { WebServer } from "./web/server";

async function initialize() {
    const configuration = await LoadConfiguration();

    Debug({ [`Active configuration`]: configuration });

    const history = new ClientHistory();

    const dnsServer = new DNSServer(configuration, history);
    await dnsServer.Start();

    const dhcpServer = new DHCPServer(configuration, dnsServer);
    await dhcpServer.Start();

    const dataServer = new DataServer(configuration, dnsServer, dhcpServer, history);
    await dataServer.Start();

    const webServer = new WebServer(configuration);
    await webServer.Start();
}

initialize()
    .catch(err => {
        // Catch any uncaught errors
        Err(err, { asIs: true });
    });
