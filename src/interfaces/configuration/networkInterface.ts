// Node Modules
import * as os from "os";

/** Represents a system interface */
interface IAvailableNetworkInterfaces {
    /** System name of interface */
    interfaceName: string;
    /** IP addresses, by IP version, assigned to the interface */
    addresses: Array<os.NetworkInterfaceInfo>;
}

export {
    IAvailableNetworkInterfaces,
};
