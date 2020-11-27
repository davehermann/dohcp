<template>
    <div class="dhcp_history_clients_component">
        <div class="panel is-primary">
            <div class="panel-heading">
                Clients Recently Producing DHCP Requests
            </div>
            <div v-if="(sortedClients.length == 0)" class="panel-block">
                <p class="has-text-info">No DHCP clients found</p>
            </div>
            <template v-else>
                <div class="panel-block">
                    Sort by:
                    <div class="tags">
                        <span class="tag is-light" :class="{ 'is-primary': currentSort == 'clientId' }" @click.stop.prevent="SortBy('clientId')">Client ID</span>
                        <span class="tag is-light" :class="{ 'is-primary': currentSort == 'lastIP' }" @click.stop.prevent="SortBy('lastIP')">IP Address</span>
                        <span class="tag is-light" :class="{ 'is-primary': currentSort == 'hostname' }" @click.stop.prevent="SortBy('hostname')">Hostname</span>
                    </div>
                </div>

                <router-link
                    v-for="client in sortedClients"
                    :key="client.clientId"
                    :to="{ name: 'dhcp-history', params: { clientId: client.clientId } }"
                    class="panel-block"
                    :class="{ 'is-active has-background-primary-light': (currentClient == client.clientId) }"
                    >
                    {{client.clientId}}
                    <template v-if="!!client.lastIP">
                        [<router-link :to="{ name: 'dns-history', params: { ipAddress: client.lastIP } }">{{client.lastIP}}</router-link><template v-if="!!client.hostname"> - {{client.hostname}}</template>]
                    </template>
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
    import { onMounted, ref, computed, watchEffect } from "vue";
    import { useRouter } from "vue-router";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const router = useRouter();

            const knownClients = ref(null),
                currentSort = ref("clientId"),
                currentClient = ref(null);

            const sortedClients = computed(() => {
                const sort = currentSort.value,
                    clientList = knownClients.value;

                if (!!clientList) {
                    clientList.sort((a, b) => {
                        return a[sort] < b[sort] ? -1 : 1;
                    });

                    return clientList;
                }

                return [];
            });

            const LoadClients = async () => {
                const response = await fetch("/data/history/dhcp/get-clients");
                const data = await response.json();

                knownClients.value = data;
            };

            const SortBy = async (sort) => {
                currentSort.value = sort;
            };

            watchEffect(() => {
                const currentRoute = router.currentRoute;

                currentClient.value = currentRoute.value.params.clientId;
            });

            onMounted(async () => {
                await LoadClients();
            });

            return {
                // data
                currentSort,
                currentClient,
                // computed
                sortedClients,
                // methods
                LoadClients,
                SortBy,
            };
        },
    };
</script>

<style scoped>
    a.panel-block { font-size: 0.8em; }
    .tag { cursor: pointer; }
    /* .dhcp_history_clients_component {} */
    /* .dhcp_history_clients_component >>> .class+id {} */
</style>
