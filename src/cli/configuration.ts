// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// Application Modules
import { SelectInterface } from "./shared";
import { Configuration as DhcpConfiguration } from "./configuration/dhcp";
import { IConfiguration } from "../interfaces/configuration/configurationFile";

// const CONFIGURATION_FILE = path.join(process.cwd(), `configuration.json`);
const CONFIGURATION_FILE = path.join(process.cwd(), `configuration2.json`);

/** Create a blank configuration template */
function emptyConfiguration(): IConfiguration {
    const config: IConfiguration = {
        logLevel: `warn`,
        interface: null,
        dhcp: null,
        dns: {
            disabled: false,
            servers: [`primaryIP`],
            domain: null,
            records: [],
        }
    };

    return config;
}

/** Walk through the process of generating a new configuration file */
async function newConfiguration() {
    const config: IConfiguration = emptyConfiguration();

    // Check for an existing GenerateConfiguration, and do not overwrite
    await checkForExistingConfiguration();

    // Get the network interface to bind to
    const { interfaceName } = await SelectInterface();
    config.interface = interfaceName;

    // Add DHCP
    config.dhcp = await DhcpConfiguration();

    console.log(JSON.stringify(config, null, 4));
}

/** Determain if a configuration already exists, and exit with an **exception** if one does */
async function checkForExistingConfiguration() {
    try {
        await fs.stat(CONFIGURATION_FILE);
        // If the fs.stat() completes successfully, a file already exists
        return Promise.reject(new Error(`${CONFIGURATION_FILE} already exists`));
    } catch (err) {
        // No file means a configuration can be generated
        if (err.code === `ENOENT`)
            return false;

        throw err;
    }
}


export {
    newConfiguration as GenerateConfiguration,
};
