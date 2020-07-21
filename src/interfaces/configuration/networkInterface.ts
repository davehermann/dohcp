// Node Modules
import * as os from "os";

interface IAvailableNetworkInterfaces {
    interfaceName: string;
    addresses: Array<os.NetworkInterfaceInfo>;
}

export {
    IAvailableNetworkInterfaces,
};
