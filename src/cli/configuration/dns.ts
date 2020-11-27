// Application Modules
import { GetInputLine } from "../shared";
import { IConfiguration as IDnsConfiguration } from "../../interfaces/configuration/dns";

/** Configure DNS */
async function configuration(): Promise<IDnsConfiguration> {
    const dns: IDnsConfiguration = {
        disabled: false,
        servers: [`primaryIP`],
        domain: null,
        records: [],
    };

    dns.domain = await domainSuffix();

    return dns;
}

/** Get the TLD suffix for all hosts registered in this DNS */
async function domainSuffix() {
    // eslint-disable-next-line no-console
    console.log(`Do you have a top-level-domain name to append to local devices?`);

    const tld = await GetInputLine(`TLD (blank for none):`);
    return tld.trim();
}

export {
    configuration as Configuration,
};
