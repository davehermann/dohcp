<template>
    <div class="for_client_component">
        <div v-if="!!historyForIp" class="panel is-info">
            <div class="panel-heading">
                Recent DNS Request History for {{currentIpHistory}}
            </div>
            <div v-for="(request, idx) in historyForIp" :key="request.question" class="panel-block column request_list" @click.stop.prevent="ToggleRequests(request)">
                <div>
                    {{historyForIp.length - idx}})
                    {{request.question}}
                    -
                    {{request.requests.length}} time{{request.requests.length == 1 ? "" : "s"}}
                </div>

                <template v-if="request.showRequests">
                    <div v-for="timestamp in request.requests" :key="timestamp" class="request">
                        {{timestamp}}
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script>
    import { ref, watchEffect } from "vue";
    import { useRouter } from "vue-router";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const router = useRouter();

            const currentIpHistory = ref(null),
                historyForIp = ref(null);

            const LoadHistoryForIp = async (ipAddress) => {
                currentIpHistory.value = ipAddress;
                const res = await fetch("/data/history/dns/for-ip/" + ipAddress);
                const data = await res.json();
                historyForIp.value = data.map(dnsEvent => {
                    return {
                        question: dnsEvent.question,
                        requests: dnsEvent.requests.map(timestamp => new Date(timestamp).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })),
                        showRequests: false,
                    };
                });
            };

            watchEffect(() => {
                const currentRoute = router.currentRoute;

                if (!!currentRoute.value.params.ipAddress)
                    LoadHistoryForIp(currentRoute.value.params.ipAddress);
                else {
                    currentIpHistory.value = null;
                    historyForIp.value = null;
                }
            });

            const ToggleRequests = request => {
                request.showRequests = !request.showRequests;
            };

            return {
                currentIpHistory,
                historyForIp,
                ToggleRequests,
            };
        },
    };
</script>

<style scoped>
    /* .for_client_component {} */
    /* .for_client_component >>> .class+id {} */
    .request_list { align-items: flex-start; }
    .request_list .request { margin-left: 2em; font-size: 0.75em;}
</style>
