// Node Modules
import * as os from "os";

function filterIPs(interfaceAddresses: Array<os.NetworkInterfaceInfo>, family = `IPv4`): Array<os.NetworkInterfaceInfo> {
    const filteredAddresses: Array<os.NetworkInterfaceInfo> = [];

    if (!!interfaceAddresses)
        interfaceAddresses
            .filter(i => { return i.family == family; })
            .forEach(i => { filteredAddresses.push(i); });

    return filteredAddresses;
}

export {
    filterIPs as FilterIPs,
};
