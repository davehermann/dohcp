# DoHCP (DNS-over-HTTPS + DHCP)

DoHCP combines both a DNS server and an DHCP server into a single package.
DHCP-assigned hosts are automatically added to the internal DNS resolution.
All DNS queries that are forwarded out for resolution go via HTTPS.
At present, DoHCP only supports Cloudflare's public HTTPS resolution via POST (more below).

##### Major Features
+ 100% pure Javascript
+ Does not use <u>any</u> dependencies
+ Command line utility `dohcp` for configuration, launch (Linux-only at present), and service queries

##### Caveats
+ IPv4-only at the current time
    + Yes, IPv6 is slowly becoming more critical, but we, unfortunately, all still live in an IPv4-driven world.
    Even in 2H 2018, many ISPs - including mine - only support IPv4.
    + DHCPv6 work has been started, but it's not included in the repository at this time
        + *DHCPv6 patches will likely not be accepted until that initial work is released*

##### Significant Issue - NodeJS <u>does *NOT*</u> support the ability to localize DHCP traffic to a single interface
*As a result, DoHCP <u>**cannot** be used on a device with a public interface</u>*

+ The NodeJS dgram `.addMembership()` method is blocked for the DHCP broadcast address (255.255.255.255) on many (maybe all?) OSes as it's outside of the [multicast address space](https://www.iana.org/assignments/multicast-addresses/multicast-addresses.xhtml)
+ NodeJS does not have a way to provide the local interface a UDP message is received on
    + [This exact DHCP scenario](https://github.com/nodejs/node-v0.x-archive/issues/8788#issuecomment-74446986) has been discussed for years in prior iterations of NodeJS development, and [discussion continues](https://github.com/nodejs/node/issues/1649) as part of active NodeJS development.
    + Until NodeJS begins supporting interface source, this cannot be resolved

##### Isn't this basically [Dnsmasq](http://www.thekelleys.org.uk/dnsmasq/doc.html)?

In terms of serving both DNS and DHCP internally, yes; however:
+ As of this writing, Dnsmasq does not support DNS-over-HTTPS
+ Dnsmasq is written in C, while DoHCP is pure Javascript
    + This may not be a plus for everyone, but it is for Javascript developers


+ Also, Dnsmasq does not have the issue with public interfaces above as it is not running on NodeJS

Dnsmasq is a very mature, well tested DNS and DHCP server that supports IPv4 and IPv6.
It's unlikely DoHCP could ever be as widespread, or feature rich, and Dnsmasq may work well in larger organizations than DoHCP can support.

## Configuration
See [Configuration](./Configuration.md) for a detailed review of the configuration options.

`dohcp init` will walk through the creation of a **configuration.json** file in the application root

### Firewall Requirements
DNS-over-HTTPS as implemented by Cloudflare (and Google) requires resolution of the DoH service provider's domain name via DNS.
Your firewall will need to forward DNS packets as a result.

### Additional Linux Requirement
By default, Linux kernels don't allow non-root users to bind to ports below 1024.
You will receive an EACCES error for the IP:PORT at service startup.

+ This can be easily overcome by allowing Node to bind to lower ports.  
`setcap cap_net_bind_service=+ep /usr/bin/node` will allow Node access to port binding.
    + After NodeJS upgrades, this may need to be re-run
+ *NOT RECOMMENDED:* You can run the service as the root user or via sudo

### Cloning existing DHCP assignments
It is possible to have DoHCP's DHCP assignments mirror an existing environment without statically assigning all clients to an address.
DoHCP uses a JSON file for permanent DHCP assignment storage that lives across restarts: **./status/dhcp.json**.
It contains an object with two properties, both objects: `{ byIp: {}, byClientId: {} }`.

To mirror the old environment in DoHCP, before starting for the first time:
1. Create the *./status/dhcp.json* with the object above in JSON form as its contents.
1. Leave the `byIp` property as an empty object
1. `byClientId` maps the client identifier to an IP address
    + The property is the client identifier type (always "01" for MAC addresses) + the identifier without any special characters
        + For a MAC of 00:14:22:01:23:45, the property will be `01001422012345`
    + The value will be the IP address to assign
        + Any dynamically assigned clients should have an IP within the pool of dynamic addresses
        + Any statically assigned clients can appear here with their address, or can be left out

The *dhcp.json* file with the example MAC above will look like this when assigning to *10.0.0.123*:
```
{
    "byIp": {},
    "byClientId": {
        "01001422012345": "10.0.0.123"
    }
}
```

## Launch

### In a terminal shell

+ `npm run server` at the command line

### As a service
*DoHCP includes a systemd unit file generator to run as a service on Linux*

+ `dohcp install` will generate a unit file, symlink to it, and start/enable the service
    + Using `--no-start` will skip the start/enable steps
    + `dohcp remove` will reverse that entire process


## Why DoHCP?

### Using DNS-over-HTTPS
Over the last several months, there's been an increase in interest in securing DNS.
DNS has historically been a weak point in security as it's transmitted in the clear and can easily be intercepted and modified for undetectable MITM attacks.
Even if you use a public DNS like [Google Public DNS](https://developers.google.com/speed/public-dns/), [Cloudflare 1.1.1.1](https://1.1.1.1/), or [OpenDNS](https://signup.opendns.com/homefree/), your ISP can easily track every domain name you're resolving, and when.
In fact, DNS can be completely intercepted and used to create an alternate Internet [as Russia is currently doing for BRICS nations](http://nymag.com/selectall/2018/07/russia-dns-alternative-internet-could-yield-cyberattack.html).

**DNS-over-HTTPS** is a method of securing the DNS information in transit.
Rather then sending DNS queries unencrypted over *UDP* or *TCP* packets, the DNS data is communicated via HTTPS.
[Google Public DNS has offered DNS-over-HTTPS via GET](https://developers.google.com/speed/public-dns/docs/dns-over-https) for quite some time.
When Cloudflare introduced their own **1.1.1.1** public DNS resolver in early 2018, [they copied Google's DoH GET option](https://developers.cloudflare.com/1.1.1.1/dns-over-https/json-format/).
In both cases, Google and Cloudflare take parameters in the querystring and return JSON data encrypted in the response.

Cloudflare also offered something new: [a DNS wireformat option that can run via GET **or POST**](https://developers.cloudflare.com/1.1.1.1/dns-over-https/wireformat/).
With an HTTPS *POST* option, **every aspect of of a DNS query can be encrypted end-to-end**.

### Adding in DHCP
While not strictly necessary for DoH usage, encapsulating both DNS and DHCP in a single package does have advantages for indexing local resources within local DNS.



## Current Status
As of initial release, DHCP and DNS have been dogfooded for months within complex home/home office environments consisting of several dozen devices spanning computers, phones, networking, and IoT.

## Future Plans
+ DoHCP-to-DoHCP communication
    + Geared toward multiple DNS servers on the network with shared internal DNS data
    + Failover DHCP
+ More extensive, and detailed, information available via the utility querying
    + Going beyond simple logging by looking at local device data - both DHCP and DNS - over time
+ DHCPv6 support has been started
    + This code may not be released for quite some time.
    + IPv6-related patches likely won't be accepted in the interim.
