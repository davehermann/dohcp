import * as http from "http";

interface IDnsOverHttpsMethod {
    /** HTTP verb identifying the method */
    method: `POST` | `GET`;
    /** Necessary HTTP headers to send with the DNS request */
    headers: Array<http.OutgoingHttpHeaders>;
}

interface IDnsOverHttps {
    /** Hostname for the DNS-over-HTTPS service provider*/
    hostname: string;
    /** Path to the DNS query service */
    path: string;
    /** HTTP verb to use for the service */
    defaultMethod: `POST` | `GET`;
    /** Configuration for the HTTP method */
    methods: Array<IDnsOverHttpsMethod>;
}

interface IResolver {
    /** Identifier for the resolver */
    name: string;
    /** List of IP addresses for the initial query to get the DNS-over-HTTPS hostname */
    servers: Array<string>;
    /** Configuration for DNS-over-HTTPS */
    doh: IDnsOverHttps;
}

interface IConfiguration {
    /** Name of the primary resolver to use */
    primary: string;
    /** List of supported resolvers */
    resolvers: Array<IResolver>
}

export {
    IConfiguration,
};
