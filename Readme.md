# DoHCP (DNS-over-HTTPS + DHCP)

DoHCP combines both a DNS server and an DHCP server into a single package.
DHCP-assigned hosts are automatically added to the internal DNS resolution.
All DNS queries that are forwarded out for resolution go via HTTPS.
At present, DoHCP only supports Cloudflare's 1.1.1.1 (and 1.0.0.1) public HTTPS resolution via POST (more below).

**Major features**
+ 100% pure Javascript
+ Does not use *any* dependencies
+ Command line utility for configuration, launch (Linux-only at present), and service queries

**Caveats**
+ IPv4-only at the current time
    + Yes, IPv6 will be critical eventually, but we all still live in an IPv4-driven world. Even in 2H 2018, many ISPs only support IPv4.

**Significant Issue - NodeJS <u>does *NOT*</u> support the ability to localize DHCP traffic to a single interface**  
*DoHCP **cannot** be used on a device with a public interface*

+ The NodeJS dgram `.addMembership()` method is blocked for the DHCP broadcast address (255.255.255.255) on many (maybe all?) OSes as it's outside of the [multicast address space](https://www.iana.org/assignments/multicast-addresses/multicast-addresses.xhtml)
+ NodeJS does not have a way to provide the local interface a UDP message is received on
    + [This exact DHCP scenario](https://github.com/nodejs/node-v0.x-archive/issues/8788#issuecomment-74446986) has been discussed for years in prior iterations of NodeJS development, and [discussion continues](https://github.com/nodejs/node/issues/1649) as part of active NodeJS development.
    + Until NodeJS begins supporting interface source, this cannot be resolved

**Isn't this basically [Dnsmasq](http://www.thekelleys.org.uk/dnsmasq/doc.html)?**

In terms of serving both DNS and DHCP internally, yes; however:
+ As of this writing, Dnsmasq does not support DNS-over-HTTPS
+ Dnsmasq is written in C, while DoHCP is pure Javascript

+ Also, Dnsmasq does not have the issue with public interfaces above as it is not running on NodeJS

Dnsmasq is a very mature, well tested DNS and DHCP server that supports IPv4 and IPv6.
It's unlikely DoHCP could ever be as widespread, or feature rich, and Dnsmasq may work well in larger organizations than DoHCP can support.

## Configuration
See [Configuration](./Configuration.md) for a detailed review of the configuration options.

`dohcp init` will walk through the creation of a `configuration.json` file in the application root

*NOTE: DNS-over-HTTPS as implemented by Cloudflare (and Google) requires resolution of the DoH service provider's domain name via DNS. Your firewall will need to forward DNS packets as a result.*


### Additional Linux Requirement
By default, Linux kernels don't allow non-root users to bind to ports below 1024.
This can be easily overcome by allowing Node to bind to lower ports.
`setcap cap_net_bind_service=+ep /usr/bin/node` will allow Node access to port binding.

## Launch

+ `npm run server` at the command line

### As a service
*DoHCP includes a systemd unit file to run as a service on Linux*

+ `dohcp install` will generate a unit file, symlink to it, and start/enable the service
    + `dohcp remove` will reverse the entire process


## Why DoHCP?

### Using DNS-over-HTTPS
Over the last several months, there's been an increase in interest in securing DNS.
DNS has historically been a weak point in security as it's transmitted in the clear and can easily be intercepted and modified for undetectable MITM attacks.
Even if you use a public DNS like [Google Public DNS](https://developers.google.com/speed/public-dns/) or [OpenDNS](https://signup.opendns.com/homefree/), your ISP can easily track every domain name you're resolving, and when.
In fact, DNS can be completely hijacked and used to create an alternate Internet [as Russia is currently doing for BRICS nations](http://nymag.com/selectall/2018/07/russia-dns-alternative-internet-could-yield-cyberattack.html).

**DNS-over-HTTPS** is a method of securing the DNS information in transit.
Rather then sending DNS queries unencrypted over *UDP* or *TCP* packets, the DNS data is communicated via HTTPS.
[Google Public DNS has offered DNS-over-HTTPS via GET](https://developers.google.com/speed/public-dns/docs/dns-over-https) for quite some time.
When Cloudflare introduced their own **1.1.1.1** public DNS resolver in early 2018, [they copied Google's DoH GET option](https://developers.cloudflare.com/1.1.1.1/dns-over-https/json-format/).
In both cases, Google and Cloudflare take parameters in the querystring and return JSON data encrypted in the response.

Cloudflare also offered something new: [a DNS wireformat option that can run via GET **or POST**](https://developers.cloudflare.com/1.1.1.1/dns-over-https/wireformat/).
With an HTTPS *POST* option, **every aspect of of a DNS query can be encrypted end-to-end**.

### Adding in DHCP
While not strictly necessary for DoH usage, encapsulating both DNS and DHCP in a single package does have advantages.
