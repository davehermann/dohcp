<template>
    <div class="history_i_ps_component">
        <div class="panel is-primary">
            <div class="panel-heading">
                IPs Recently Producing DNS Requests
            </div>
            <a
                v-for="ipAddress in historyIPs"
                :key="ipAddress"
                class="panel-block"
                href="#"
                @click.stop.prevent="LoadHistoryForIp(ipAddress)"
                >
                {{ipAddress}}
            </a>
            <div v-if="!historyIPs || (historyIPs.length == 0)" class="panel-block">
                <p class="has-text-info">No recent DNS history found</p>
            </div>
            <div class="panel-block">
                <button class="button is-primary is-outlined is-fullwidth" @click.stop.prevent="LoadIPs">
                    Refresh
                </button>
            </div>
        </div>

        <div v-if="!!historyForIp" class="panel is-info">
            <div class="panel-heading">
                Recent DNS Request History for {{currentIpHistory}}
            </div>
            <div v-for="(request, idx) in historyForIp" :key="request.question" class="panel-block request_list" @click.stop.prevent="ToggleRequests(request)">
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
    import { onMounted, ref } from "vue";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const historyIPs = ref(null),
                historyForIp = ref(null),
                currentIpHistory = ref(null);

            onMounted(() => {
                LoadIPs();
            });

            async function LoadIPs() {
                const res = await fetch("/data/history/dns/recent-ips");
                const data = await res.json();
                historyIPs.value = data;
            }

            async function LoadHistoryForIp(ipAddress) {
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
                console.log(historyForIp.value);
            }

            function ToggleRequests(request) {
                request.showRequests = !request.showRequests;
            }

            return {
                // data
                currentIpHistory,
                historyIPs,
                historyForIp,
                // methods
                LoadHistoryForIp,
                LoadIPs,
                ToggleRequests,
            };
        },
    };
</script>

<style scoped>
    /* .history_i_ps_component {} */
    /* .history_i_ps_component >>> .class+id {} */
    .request_list { flex-direction: column; align-items: flex-start; }
    .request_list .request { margin-left: 2em; font-size: 0.75em;}
</style>
