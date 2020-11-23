<template>
    <div class="dhcp_history_clients_component">
        <div class="panel is-primary">
            <div class="panel-heading">
                Clients Recently Producing DHCP Requests
            </div>
            <div v-if="!knownClients || (knownClients.length == 0)" class="panel-block">
                <p class="has-text-info">No DHCP clients found</p>
            </div>
            <template v-else>
                <router-link
                    v-for="client in knownClients"
                    :key="client.clientId"
                    class="panel-block"
                    :to="{ name: 'dhcp-history', params: { clientId: client.clientId } }"
                    >
                    {{client.clientId}}
                    <template v-if="!!client.lastIP">[{{client.lastIP}}]</template>
                </router-link>
            </template>
            <div class="panel-block">
                <button class="button is-primary is-outlined is-fullwidth" @click.stop.prevent="LoadClients">
                    Refresh
                </button>
            </div>
        </div>
    </div>
</template>

<script>
    import { onMounted, ref } from "vue";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const knownClients = ref(null);

            const LoadClients = async () => {
                const response = await fetch("/data/history/dhcp/get-clients");
                const data = await response.json();

                knownClients.value = data;
            };

            onMounted(async () => {
                await LoadClients();
            });

            return {
                // data
                knownClients,
                // methods
                LoadClients,
            };
        },
    };
</script>

<style scoped>
    a.panel-block { font-size: 0.8em; }
    /* .dhcp_history_clients_component {} */
    /* .dhcp_history_clients_component >>> .class+id {} */
</style>
