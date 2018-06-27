# Linux Configuration

By default, Linux kernels don't allow non-root users to bind to ports below 1024.
This can be easily overcome by allowing Node to bind to lower ports.
`setcap cap_net_bind_service=+ep /usr/bin/node` will allow Node access to port binding.

# Use on a router
At the present time, NodeJS does *NOT* support the ability to localize traffic to a single interface.
+ The dgram `.addMembership()` for the DHCP multicast address (255.255.255.255) is blocked for many OS implementations as it's outside of the [multicast address space](https://www.iana.org/assignments/multicast-addresses/multicast-addresses.xhtml).
    + This is presently the only option open to NodeJS given the below bullet.
+ Node itself does not have a way to provide the local interface a UDP packet was received on, and thus a way to filter incoming packets.
    + [This exact scenario](https://github.com/nodejs/node-v0.x-archive/issues/8788#issuecomment-74446986) has been discussed previously, and [discussion continues](https://github.com/nodejs/node/issues/1649).

The only viable use-case at present is on a system that exists fully within a physical intranet.

*NOTE: Since DNS is exclusively handled over HTTP, your firewall will not have to forward any DNS packets*

# DNS
## Local domain
Specifying a `domain` string will force DHCP records to append the domain.

## Adding Local A and CNAME records
A `records` array holds objects with 2 properties
+ `{ name, ip }` - A record
+ `{ name, alias }` - CNAME

For both objects, if a `domain` has been specified and the `name` field does not end with it, both the `name` field value, and the value with the `domain` appended
