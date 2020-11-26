<template>
    <div class="dhcp_history_for_client_component">
        <div v-if="!!sortedHistory" class="panel is-info">
            <div class="panel-heading">
                DHCP Requests for {{selectedClient}}
            </div>
            <div v-if="clientVendors.length > 0" class="panel-block">
                <div v-for="vendor in clientVendors" :key="vendor.id" class="column manufacturer">
                    <span>Vendor for <strong>{{vendor.id.match(/../g).join(':')}}</strong></span>
                    <span>{{vendor.name}}</span>
                    <span>{{vendor.address}}</span>
                </div>
            </div>
            <div class="panel-block">
                <div class="field is-grouped is-grouped-multiline">
                    <div class="control">
                        <div class="tags has-addons">
                            <span class="tag" :class="{ 'is-info': !reverseOrder }" @click.stop.prevent="ToggleOrder">Chronological</span>
                            <span class="tag" :class="{ 'is-info': reverseOrder }" @click.stop.prevent="ToggleOrder">Reverse Chronological</span>
                        </div>
                    </div>
                </div>
            </div>
            <div
                v-for="history in sortedHistory"
                :key="history.timestamp"
                class="panel-block row"
                :class="{ 'has-background-danger-light': (history.messageType == `DHCPNAK`) }"
                >
                <template v-if="!!history.ipAddress">
                    <span class="title-block">
                        IP Address Assigned:
                    </span>
                    <span>
                        [{{history.timestamp.toLocaleString(undefined, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })}}]
                        <router-link :to="{ name: 'dns-history', params: { ipAddress: history.ipAddress } }">{{history.ipAddress}}</router-link>
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
    import { ref, watchEffect, computed } from "vue";
    import { useRouter } from "vue-router";

    export default {
        setup(props/*, { attrs, slots, emit }*/) {
            const router = useRouter();

            const selectedClient = ref(null),
                clientHistory = ref(null),
                clientVendors = ref([]);

            const reverseOrder = ref(true);

            const sortedHistory = computed(() => {
                if (!clientHistory.value)
                    return null;

                const currentOrder = reverseOrder.value;

                const filteredHistory = clientHistory.value.filter(() => true);

                if (currentOrder)
                    filteredHistory.reverse();

                return filteredHistory;
            });

            const LoadHistoryForClient = async (clientId) => {
                selectedClient.value = clientId;

                const response = await fetch("/data/history/dhcp/for-client/" + clientId);
                const data = await response.json();

                clientVendors.value = data.vendors;

                const history = data.events.map(dhcpEvent => {
                    const eventData = {
                        timestamp: new Date(dhcpEvent.timestamp),
                        ipAddress: dhcpEvent.ipAddress,
                        dnsHostname: dhcpEvent.dnsHostname,
                        clientMessage: dhcpEvent.clientMessage,
                        serverMessage: dhcpEvent.serverResponse
                    };

                    const message = eventData.clientMessage || eventData.serverMessage;

                    if (!!message) {
                        eventData.messageType = message.options.options.find(opt => (opt.name == "dhcpMessageType"))?.value;
                    }

                    return eventData;
                });

                clientHistory.value = history;
            };

            const ToggleOrder = () => {
                reverseOrder.value = !reverseOrder.value;
            };

            watchEffect(() => {
                const route = router.currentRoute;

                if (!!route.value.params.clientId)
                    LoadHistoryForClient(route.value.params.clientId);
                else {
                    selectedClient.value = null;
                    clientHistory.value = null;
                }
            });

            return {
                // data
                selectedClient,
                reverseOrder,
                clientVendors,
                // computed
                sortedHistory,
                // methods
                ToggleOrder,
            };
        },
    };
</script>

<style scoped>
    .panel .panel-block { font-size: 0.8em; align-items: flex-start; }
    .panel .panel-block .title-block { font-weight: bold; margin-right: 0.5em; }
    .tag { cursor: pointer; }
    .manufacturer span:first-child { text-decoration: underline; }
    /* .dhcp_history_for_client_component {} */
    /* .dhcp_history_for_client_component >>> .class+id {} */
</style>
