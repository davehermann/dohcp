<template>
    <div class="dns_clients_component">
        <div class="panel is-primary">
            <div class="panel-heading">
                IPs Recently Producing DNS Requests
            </div>
            <router-link
                v-for="client in historyIPs"
                :key="client.ipAddress"
                :to="{ name: 'dns-history', params: { ipAddress: client.ipAddress } }"
                class="panel-block"
                :class="{ 'is-active has-background-primary-light': selectedIP == client.ipAddress }"
                >
                {{client.ipAddress}}

                &nbsp;

                <router-link v-if="!!client.clientId" :to="{ name: 'dhcp-history', params: { clientId: client.clientId } }">
                    [{{client.clientId}}]
                </router-link>
            </router-link>
            <div v-if="!historyIPs || (historyIPs.length == 0)" class="panel-block">
                <p class="has-text-info">No recent DNS history found</p>
            </div>
            <div class="panel-block">
                <button class="button is-primary is-outlined is-fullwidth" @click.stop.prevent="LoadIPs">
                    Refresh
                </button>
            </div>
        </div>
    </div>
</template>

<script>
    import { onMounted, ref, watchEffect } from "vue";
    import { useRouter } from "vue-router";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const router = useRouter();

            const historyIPs = ref(null),
                selectedIP = ref(null);

            onMounted(() => {
                LoadIPs();
            });

            const LoadIPs = async () => {
                const response = await fetch("/data/history/dns/recent-ips");
                const data = await response.json();

                // Load DHCP leases to try to find matching IPs
                const dhcpLeaseResponse = await fetch("/data/dhcp/leases");
                const { leaseData } = await dhcpLeaseResponse.json();
                console.log(leaseData.map(lease => { return { ipAddress: lease.ipAddress, clientId: lease.clientId.substr(2).match(/../g).join(":") }; }));

                const ipMatchedClient = data.map(ipAddress => {
                    return {
                        ipAddress,
                        clientId: leaseData.find(lease => (lease.ipAddress == ipAddress))?.clientId.substr(2).match(/../g).join(":"),
                    };
                });

                historyIPs.value = ipMatchedClient;
            };

            watchEffect(() => {
                const currentRoute = router.currentRoute;

                selectedIP.value = currentRoute.value.params.ipAddress;
            });

            return {
                // data
                historyIPs,
                selectedIP,
                // methods
                LoadIPs,
            };
        },
    };
</script>

<style scoped>
    /* .dns_clients_component {} */
    /* .dns_clients_component >>> .class+id {} */
</style>
