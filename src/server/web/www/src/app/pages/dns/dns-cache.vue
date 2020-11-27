<template>
    <div class="dns_cache_page">
        <h1>Dns Cache</h1>

        <section class="section">
            <div class="field is-grouped is-grouped-multiline">
                <div class="control">
                    <div class="tags has-addons">
                        <span class="tag" :class="{ 'is-primary': !showAll }" @click.stop.prevent="ToggleAll">Local DNS Only</span>
                        <span class="tag" :class="{ 'is-primary': showAll }" @click.stop.prevent="ToggleAll">All Cached DNS</span>
                    </div>
                </div>
            </div>
        </section>

        <section class="section">
            <table class="table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Request</th>
                        <th>Record Type</th>
                        <th>Answer</th>
                        <th>Expiration</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(record, idx) in dnsCache" :key="record.label">
                        <th>{{idx + 1}}</th>
                        <td>{{record.label}}</td>
                        <td>{{record.typeId}}</td>
                        <td>{{record.answer}}</td>
                        <td v-if="!record.ttl">
                            <em>Static Assignment</em>
                        </td>
                        <td v-else>{{record.ttl}} second{{record.ttl === 1 ? "" : "s"}}</td>
                    </tr>
                </tbody>
            </table>
        </section>
    </div>
</template>

<script>
    import { onMounted, ref, computed } from "vue";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const cacheEntries = ref([]),
                showAll = ref(false);

            const dnsCache = computed(() => {
                const currentTime = new Date();
                const cacheList = cacheEntries.value.map(entry => {
                    const cacheItem = {
                        label: entry.label,
                        typeId: entry.typeId,
                        answer: entry.rdata[0],
                        ttl: !!entry.startingTTL ? Math.round((entry.ttlExpiration - currentTime) / 1000) : null,
                        noExpiration: entry.noExpiration,
                    };

                    return cacheItem;
                });

                cacheList.sort((a, b) => (a.label.toLowerCase() < b.label.toLowerCase() ? -1 : 1));

                return cacheList;
            });

            const LoadCache = async () => {
                let requestPath = "/data/dns/cache-list";
                if (showAll.value)
                    requestPath += "/all";

                const response = await fetch(requestPath);
                const data = await response.json();

                cacheEntries.value.splice(0, cacheEntries.length, ...data);
            };

            const ToggleAll = () => {
                showAll.value = !showAll.value;
                LoadCache();
            };

            onMounted(() => {
                LoadCache();
            });

            return {
                // data
                showAll,
                // computed
                dnsCache,
                // methods
                ToggleAll,
            };
        },
    };
</script>

<style scoped>
    .tag { cursor: pointer; }
    th { text-align: center; }
    .right { text-align: right; }
    /* .dns_cache_page {} */
    /* .dns_cache_page >>> .class+id {} */
</style>
