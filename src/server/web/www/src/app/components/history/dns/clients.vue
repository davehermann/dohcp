<template>
    <div class="dns_clients_component">
        <div class="panel is-primary">
            <div class="panel-heading">
                IPs Recently Producing DNS Requests
            </div>
            <router-link
                v-for="ipAddress in historyIPs"
                :key="ipAddress"
                :to="{ name: 'dns-history', params: { ipAddress } }"
                class="panel-block"
                :class="{ 'is-active has-background-primary-light': selectedIP == ipAddress }"
                >
                {{ipAddress}}
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
                const res = await fetch("/data/history/dns/recent-ips");
                const data = await res.json();
                historyIPs.value = data;
            };

            watchEffect(() => {
                const currentRoute = router.currentRoute;

                selectedIP.value = currentRoute.value.params.ipAddress;
            });

            return {
                historyIPs,
                selectedIP,
            };
        },
    };
</script>

<style scoped>
    /* .dns_clients_component {} */
    /* .dns_clients_component >>> .class+id {} */
</style>
