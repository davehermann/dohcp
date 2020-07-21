// Application Modules
import { GetInputLine } from "../shared";
import { IConfiguration as IDhcpConfiguration, IRange as IDhcpPoolRange, IStaticAssignment as IDhcpStaticAssignment } from "../../interfaces/configuration/dhcp";

/** Generate a DHCP configuration section */
async function configuration(): Promise<IDhcpConfiguration> {
    const dhcpAnswer = await GetInputLine(`Configure DHCP? [Y/n]:`);
    const configureDhcp = !dhcpAnswer || (dhcpAnswer.toLowerCase() == `y`);

    const dhcp: IDhcpConfiguration = { disabled: true };

    if (configureDhcp) {
        dhcp.disabled = false;
        dhcp.authoritative = true;

        dhcp.leases = {
            pool: {
                leaseSeconds: null,
                networkMask: null,
                ranges: null,
            },
            static: new Map<string, IDhcpStaticAssignment>(),
        };

        dhcp.routers = await gateways();

        dhcp.leases.pool.leaseSeconds = await leaseLength();
        dhcp.leases.pool.ranges = await poolRange();
        dhcp.leases.pool.networkMask = await subnetMask();
    }

    return dhcp;
}

/** Get the IP address(es) for network gateway devices */
async function gateways() {
    const ips = await GetInputLine(`Enter gateway IPs (comma-separated for multiple):`);
    return ips.split(`,`);
}

/** Specify the length (in seconds) for IP assignment lease expiration */
async function leaseLength(): Promise<number> {
    let expireIn = 3600;
    const expirationLength = await GetInputLine(`Time, in seconds, before a DHCP lease expires [default: ${expireIn}]:`);

    if (!!expirationLength) {
        expireIn = parseInt(expirationLength, 10);

        if (isNaN(expireIn)) {
            // eslint-disable-next-line no-console
            console.log(`Please enter a whole number of seconds.`);
            expireIn = await leaseLength();
        }
    }

    return expireIn;
}

/** Set the range(s) for IP address assignment pools */
async function poolRange(addedRanges?: Array<IDhcpPoolRange>): Promise<Array<IDhcpPoolRange>> {
    if (!addedRanges) {
        addedRanges = [];
        console.log(`Add one, or more, address ranges to the pool`);
    }

    const newRange: IDhcpPoolRange = { start: null, end: null };

    newRange.start = await GetInputLine(`Start of range:`);
    newRange.end = await GetInputLine(`End of range:`);
    addedRanges.push(newRange);

    const addMore = await GetInputLine(`Add another range to your address pool? [y/N]:`);
    if (!!addMore && (addMore.search(/^Y$/i) == 0))
        return poolRange(addedRanges);

    return addedRanges;
}

/** Configure the subnet mask for the assignment pool */
async function subnetMask(): Promise<string> {
    const defaultMask = `255.255.255.0`;
    const networkMask = await GetInputLine(`What is the subnet mask for your network? [default: ${defaultMask}]:`);
    return networkMask || defaultMask;
}

export {
    configuration as Configuration,
};
