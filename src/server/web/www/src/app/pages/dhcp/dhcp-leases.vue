<template>
    <div class="dhcp_leases_page">
        <h1 class="is-size-2">DHCP Leases</h1>

        <table v-if="!!leasesDisplayed" class="table">
            <thead>
                <tr>
                    <th></th>
                    <th>Client ID</th>
                    <th>IP Address Assigned</th>
                    <th>Assignment Confirmed</th>
                    <th>Lease Start</th>
                    <th>Host Name from Client</th>
                    <th>Hostname in Server Configuration</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(client, idx) in leasesDisplayed" :key="client.clientId">
                    <th class="right">{{idx + 1}}</th>
                    <td>{{client.clientId}}</td>
                    <td>{{client.ipAddress}}</td>
                    <td>{{client.isConfirmed}}</td>
                    <td>{{client.leaseStart.toLocaleString()}}</td>
                    <td>{{client.providedHost}}</td>
                    <td>{{client.staticHost}}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
    import { onMounted, ref, computed } from "vue";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const leases = ref([]);

            const leasesDisplayed = computed(() => {
                const leaseData = leases.value.map(lease => {
                    const newData = {};

                    for (let prop in lease) {
                        let value = lease[prop];

                        switch (prop) {
                            case "clientId":
                                // Display as MAC address
                                value = value.substr(2).match(/../g).join(":");
                                break;

                            case "leaseStart":
                                // Convert to date
                                value = new Date(value);
                                break;
                        }

                        newData[prop] = value;
                    }

                    return newData;
                });

                // Sort

                return leaseData;
            });

            const LoadLeases = async () => {
                const response = await fetch("/data/dhcp/leases");
                const { leaseData } = await response.json();

                leases.value.splice(0, leases.value.length, ...leaseData);
            };

            onMounted(() => {
                LoadLeases();
            });

            return {
                leasesDisplayed,
            };
        },
    };
</script>

<style scoped>
    /* .dhcp_leases_page {} */
    /* .dhcp_leases_page >>> .class+id {} */
    th { text-align: center; }
    .right { text-align: right; }
</style>
