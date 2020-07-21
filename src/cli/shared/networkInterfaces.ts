// Node Modules
import * as os from "os";

// Application Modules
import { TABS, GetInputLine } from "./ui";
import { IAvailableNetworkInterfaces } from "../../interfaces/configuration/networkInterface";


/** Select a network interface via the CLI */
async function selectInterface(): Promise<IAvailableNetworkInterfaces> {
    const interfaces = displayAvailableInterfaces();
    const selectedInterface = await askForInterfaceToUse();

    if (!interfaces[selectedInterface]) {
        // eslint-disable-next-line no-console
        console.log(`\nINTERFACE '${selectedInterface}' NOT FOUND\n`);
        return selectInterface();
    } else
        return { interfaceName: selectedInterface, addresses: interfaces[selectedInterface] };
}

/** List available network interfaces on the system */
function displayAvailableInterfaces(): NodeJS.Dict<os.NetworkInterfaceInfo[]> {
    const interfaces = os.networkInterfaces(),
          available: Array<IAvailableNetworkInterfaces> = [];

    for (const name in interfaces)
        available.push({ interfaceName: name, addresses: interfaces[name] });

    // eslint-disable-next-line no-console
    console.log(`Available network interfaces`);
    available.forEach(i => {
        // eslint-disable-next-line no-console
        console.log(`${TABS}${i.interfaceName}: ${i.addresses.map(a => { return `${a.family} - ${a.address}`; }).join(`, `)}`);
    });

    return interfaces;
}

/** Ask the user to enter the name of an interface found on the system */
async function askForInterfaceToUse(): Promise<string> {
    return GetInputLine(`Bind to interface:`);
}

export {
    selectInterface as SelectInterface,
};
