<template>
    <div class="for_client_component">
        <div v-if="!!sortedHistory" class="panel is-info">
            <div class="panel-heading">
                Recent DNS Request History for {{currentIpHistory}}
            </div>
            <div class="panel-block">
                <div class="field is-grouped is-grouped-multiline">
                    <div class="control">
                        <div class="tags has-addons">
                            <span class="tag" :class="{ 'is-info': sortOrder == 'last-used' }" @click.stop.prevent="ChangeSort('last-used')">Last Used</span>
                            <span class="tag" :class="{ 'is-info': sortOrder == `reverse-last-used` }" @click.stop.prevent="ChangeSort('reverse-last-used')">Reverse Last Used</span>
                        </div>
                    </div>

                    <div class="control">
                        <div class="tags has-addons">
                            <span class="tag" :class="{ 'is-info': sortOrder == 'by-domain' }" @click.stop.prevent="ChangeSort('by-domain')">Domain Name</span>
                            <span class="tag" :class="{ 'is-info': sortOrder == `reverse-by-domain` }" @click.stop.prevent="ChangeSort('reverse-by-domain')">Reverse Domain Name</span>
                        </div>
                    </div>

                    <div class="control">
                        <div class="tags has-addons">
                            <span class="tag" :class="{ 'is-info': sortOrder == 'by-request-count' }" @click.stop.prevent="ChangeSort('by-request-count')">Number of Requests</span>
                            <span class="tag" :class="{ 'is-info': sortOrder == `reverse-by-request-count` }" @click.stop.prevent="ChangeSort('reverse-by-request-count')">Reverse Number of Requests</span>
                        </div>
                    </div>
                </div>
            </div>
            <div v-for="(request, idx) in sortedHistory" :key="request.question" class="panel-block column request_list" @click.stop.prevent="ToggleRequests(request)">
                <div>
                    {{sortedHistory.length - idx}})
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
    import { ref, watchEffect, computed } from "vue";
    import { useRouter } from "vue-router";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const router = useRouter();

            const currentIpHistory = ref(null),
                historyForIp = ref(null);

            const sortOrder = ref("last-used");

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

            const sortedHistory = computed(() => {
                if (!historyForIp.value)
                    return null;

                const ipHistory = historyForIp.value.filter(() => true),
                    sortBy = sortOrder.value;

                switch (sortBy) {
                    case "reverse-last-used":
                        ipHistory.reverse();
                        break;

                    case "by-domain":
                        ipHistory.sort((a, b) => (a.question.toLowerCase() < b.question.toLowerCase() ? -1 : 1));
                        break;

                    case "reverse-by-domain":
                        ipHistory.sort((a, b) => (a.question.toLowerCase() > b.question.toLowerCase() ? -1 : 1));
                        break;

                    case "by-request-count":
                        ipHistory.sort((a, b) => (a.requests.length < b.requests.length ? -1 : 1));
                        break;

                    case "reverse-by-request-count":
                        ipHistory.sort((a, b) => (a.requests.length > b.requests.length ? -1 : 1));
                        break;
                }

                // By default last-used
                return ipHistory;
            });

            const ChangeSort = newSort => {
                sortOrder.value = newSort;
            };

            const ToggleRequests = request => {
                request.showRequests = !request.showRequests;
            };

            return {
                currentIpHistory,
                sortedHistory,
                sortOrder,
                ChangeSort,
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
    .tag { cursor: pointer; }
</style>
