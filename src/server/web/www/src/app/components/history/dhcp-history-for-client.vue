<template>
    <div class="dhcp_history_for_client_component">
        <div v-if="!!clientHistory" class="panel is-info">
            <div class="panel-heading">
                DHCP Requests for {{selectedClient}}
            </div>
            <div
                v-for="history in clientHistory"
                :key="history.timestamp"
                class="panel-block"
                >
                [{{history.timestamp.toLocaleString(undefined, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })}}]
                {{history.ipAddress}}
                <template v-if="!!history.dnsHostname"> - {{history.dnsHostname}}</template>
            </div>
        </div>
    </div>
</template>

<script>
    import { ref, watchEffect } from "vue";
    import { useRouter } from "vue-router";

    export default {
        setup(props/*, { attrs, slots, emit }*/) {
            const router = useRouter();

            const selectedClient = ref(null),
                clientHistory = ref(null);

            const LoadHistoryForClient = async (clientId) => {
                selectedClient.value = clientId;

                const response = await fetch("/data/history/dhcp/for-client/" + clientId);
                const data = await response.json();

                const history = data.filter(dhcpEvent => !!dhcpEvent.ipAddress).map(dhcpEvent => {
                    return {
                        timestamp: new Date(dhcpEvent.timestamp),
                        ipAddress: dhcpEvent.ipAddress,
                        dnsHostname: dhcpEvent.dnsHostname,
                    };
                });

                clientHistory.value = history;
            };

            watchEffect(() => {
                const route = router.currentRoute;

                if (!!route.value.params.clientId)
                    LoadHistoryForClient(route.value.params.clientId);
            });

            return {
                selectedClient,
                clientHistory,
            };
        },
    };
</script>

<style scoped>
    .panel .panel-block { font-size: 0.8em; }
    /* .dhcp_history_for_client_component {} */
    /* .dhcp_history_for_client_component >>> .class+id {} */
</style>
