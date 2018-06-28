# Linux Configuration

By default, Linux kernels don't allow non-root users to bind to ports below 1024.
This can be easily overcome by allowing Node to bind to lower ports.
`setcap cap_net_bind_service=+ep /usr/bin/node` will allow Node access to port binding.

# Use on a router
**At the present time, NodeJS <u>does *NOT*</u> support the ability to localize DHCP traffic to a single interface.**
+ The dgram `.addMembership()` method for the DHCP broadcast address (255.255.255.255) is blocked for many OS implementations as it's outside of the [multicast address space](https://www.iana.org/assignments/multicast-addresses/multicast-addresses.xhtml).
    + `.addMembership()` is the NodeJS way to bind listening on a single, specific interface IP
+ While an alternative to responding to broadcast messages on one IP would be filtering all requests on all IPs for only those from the IP/interface we want, NodeJS itself does not have a way to provide which local interface a UDP packet was received on, and thus doesn't have a way to filter incoming packets.
    + [This exact DHCP scenario](https://github.com/nodejs/node-v0.x-archive/issues/8788#issuecomment-74446986) has been discussed for years of prior NodeJS development, and [discussion continues](https://github.com/nodejs/node/issues/1649) as part of active development.

The only viable use-case at present is on a system that exists fully within a physical intranet, i.e. no NICs connected to public networks.

# DNS

*NOTE: DNS-over-HTTPS as implemented by Cloudflare (and Google) requires resolution of the DoH domain name via DNS. Your firewall will need to forward DNS packets as a result.*

## Local domain
Specifying a `domain` string will force DHCP records to append the domain.

## Adding Local A and CNAME records
A `records` array holds objects with 2 properties
+ `{ name, ip }` - A record
+ `{ name, alias }` - CNAME

For both objects, if a `domain` has been specified and the `name` field does not end with it, both the `name` field value, and the value with the `domain` appended
