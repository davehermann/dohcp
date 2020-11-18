# Configuration Options

## JSON Schema

A complete [JSON schema](https://json-schema.org/) is provided.
Your configuration file should start as:

```json
    {
        "$schema": "./dist/configuration-schemas/dohcp-configuration.json"
    }
```

## Getting Started

As noted in the [Readme](./Readme.md), `dohcp init` will walk through the creation of a `configuration.json` file in the application root

The simplest configuration JSON would be

```json
    {
        "$schema": "./dist/configuration-schemas/dohcp-configuration.json",
        "logLevel": "warn",
        "interface": null,
        "dhcp": {
            "disabled": true,
        },
        "dns": {
            "disabled": true,
        }
    }
```
*This file won't run either a DHCP or DNS service as both are disabled.*

## logLevel
**string**

Possible values are: trace, debug, info, warn, error, fatal.
By default, DoHCP uses *warn* and the logLevel option can be omitted.

Additionally, both the `dhcp` object and the `dns` object can have their own independent **logLevel** value for chasing down issues with only one of the services.

*In general, we recommend setting logging to `error` once you've completed setup and testing in your environment*

## interface
**string**

The name of the interface DoHCP is to utilize.
If you run `dohcp init` *without* a *configuration.json* file in the application root, the first question will list all interfaces on the system and ask

## dhcp
**object**

### dhcp.disabled
**boolean**
*optional*

+ **true** turns off the DHCP service
+ Default is **false**

### dhcp.logLevel
**string**
*optional*

+ Overrides the root-defined logLevel value specifically for the DHCP service

### dhcp.authoritative
**boolean**
*optional*

+ **true** acts as an authoritative server responding to any DHCPREQUEST even when no server identifier is provided by the client
+ Default is **false**; however, *recommendation* is to set to true when DoHCP is the only DHCP service on the subnet

### dhcp.routers
**array** of **string** [IP addresses]

+ This should list all gateway devices on the subnet

### dhcp.leases
**object**

+ Has two child properties: *pool* and *static*

#### dhcp.leases.pool
**object**

+ Defines the DHCP lease parameters

##### dhcp.leases.pool.leaseSeconds
**integer**

+ Time in seconds that for a lease to expire
    + DoHCP delivers a renewal time value at 3/4 of lease expiration
    + DoHCP delivers a rebinding time value at 7/8 of lease expiration

##### dhcp.leases.pool.networkMask
**string**

+ Subnet mask for the local subnet

##### dhcp.leases.pool.ranges
**array** of **object**

+ The allowed range(s) for IP distribution
+ Each range object will define *start* and *end* IP address properties
+ e.g.
        "ranges": [
            { "start": "192.168.1.41", "end": "192.168.1.90" }
        ]
     allocates 50 IPs for possible distribution

#### dhcp.leases.static
**object**

+ Each property **key** will be the client identifier delivered by the DHCP client
    + Typically, this would be the MAC address of the client
+ Each property **value** will be an object that includes an *ip* property with the IP address to assign
    + The **value** object can also contain a *hostname** property with a specifically defined hostname to add to DNS
+ e.g.
        "static": {
            "01:23:45:67:89:ab": { "ip": "192.168.1.100" , "hostname": "jane-desktop" }
        }
    will assign the client that identifies with "01:23:45:67:89:ab" to the IP of "192.168.1.100" and will add "jane-desktop" to the DNS known host names


**NOTE: Any statically assigned IPs will be automatically removed from the pool range(s) if any pool overlaps with the defined static assignment**

## dns
**object**

### dns.disabled
**boolean**
*optional*

+ **true** turns off the DHCP service
+ Default is **false**

### dns.logLevel
**string**
*optional*

+ Overrides the root-defined logLevel value specifically for the DHCP service

### dns.servers
**array** of **string**

+ Defines a list of DNS servers to send to DHCP clients
+ The special value *primaryIP* will be defined as the IP assigned to the **interface** defined at the configuration root
+ e.g.
        "servers": ["primaryIP", "192.168.1.2"]
    The value *primaryIP* should always be listed - and listed first - if this server is acting as the DNS server for the subnet, and any additional backup DNS servers should be appended to the list

### dns.domain
**string**
*optional*

+ A local domain suffix
    + Any DNS records' names defined in this configuration that do not end with this suffix value will be added both as-is and with this value appended
    + Any DHCP clients' name - static and dynamic - that do not end with this suffix value will be added both as-is and with this value appended
+ e.g.
        "domain": "exampledomain.local"
    For the DHCP static example above, this would cause, both **jane-desktop** and **jane-desktop.exampledomain.local** to be added to DNS when DHCP assigns the address

### dns.records
**array** of **objects**
*optional*

+ Locally defined A and CNAME records
+ Each object contains
    + A *name* property, which is the name that will be added to DNS
    + Either an *ip* or an *alias* property which is the value returned by DNS
+ e.g.
        "records": [
            { "name": "intranet", "ip": "192.168.1.10" },
            { "name": "mailclient", "alias": "intranet" },
            { "name": "printer", "alias": "jane-desktop" }
        ]
    + *intranet* will be added as an A record pointing to *192.168.1.10*
        + With the value for **domain** defined, *intranet.exampledomain.local* will also be added as an A record pointing to *192.168.1.10*
    + *mailclient* will be added as a CNAME pointing to *intranet*
        + With the value for **domain** defined, *mailclient.exampledomain.local* will also be added as a CNAME pointing to *intranet*
    + *printer* will be added as a CNAME pointing to *jane-desktop*. Since *jane-desktop* is not defined with these DNS records, resolution will only complete if DHCP has assigned an address to a client with the hostname of *jane-desktop*.
        + With the value for **domain** defined, *printer.exampledomain.local* will also be added as a CNAME pointing to *jane-desktop*
