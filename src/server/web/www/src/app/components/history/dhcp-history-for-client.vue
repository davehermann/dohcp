<template>
    <div class="dhcp_history_for_client_component">
        <div v-if="!!clientHistory" class="panel is-info">
            <div class="panel-heading">
                DHCP Requests for {{selectedClient}}
            </div>
            <div
                v-for="history in clientHistory"
                :key="history.timestamp"
                class="panel-block row"
                >
                <template v-if="!!history.ipAddress">
                    <span class="title-block">
                        IP Address Assigned:
                    </span>
                    <span>
                        [{{history.timestamp.toLocaleString(undefined, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })}}]
                        {{history.ipAddress}}
                        <template v-if="!!history.dnsHostname"> - {{history.dnsHostname}}</template>
                    </span>
                </template>

                <template v-if="!!history.clientMessage">
                    <span class="title-block">
                        Received from Client:
                    </span>
                    <dhcp-message-summary :dhcp-message="history.clientMessage" :timestamp="history.timestamp"></dhcp-message-summary>
                </template>

                <template v-if="!!history.serverMessage">
                    <span class="title-block">
                        Sent to Client:
                    </span>
                    <dhcp-message-summary :dhcp-message="history.serverMessage" :timestamp="history.timestamp"></dhcp-message-summary>
                </template>
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

                const history = data.map(dhcpEvent => {
                    return {
                        timestamp: new Date(dhcpEvent.timestamp),
                        ipAddress: dhcpEvent.ipAddress,
                        dnsHostname: dhcpEvent.dnsHostname,
                        clientMessage: dhcpEvent.clientMessage,
                        serverMessage: dhcpEvent.serverResponse,
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
    .panel .panel-block { font-size: 0.8em; align-items: flex-start; }
    .panel .panel-block .title-block { font-weight: bold; margin-right: 0.5em; }
    /* .dhcp_history_for_client_component {} */
    /* .dhcp_history_for_client_component >>> .class+id {} */
</style>
