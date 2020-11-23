<template>
    <div class="app_component">
        <div class="row">
            <h1 class="grow is-size-3">DoHCP Status</h1>
            <div v-if="!!systemData" class="is-size-7">
                <p>
                    Total Memory: {{Math.round(systemData.totalMemory * 100) / 100}} MB
                </p>
                <p>
                    Heap Usage: {{Math.round(systemData.heapSize * 100) / 100}} MB
                </p>
                <div>
                    <progress class="progress is-primary is-small" :value="Math.round(systemData.heapPercent * 100)" max="100">{{Math.round(systemData.heapPercent * 100)}} %</progress>
                </div>
            </div>
        </div>
        <template v-if="isInitialized">
            <router-link v-if="($route.name != 'home')" :to="{ name: 'home'}">[Home]</router-link>
            <hr />
            <router-view></router-view>
        </template>
        <template v-else>
            <div class="text-center">
                <!-- <mdi size="5" spin>star</mdi> -->
                ...LOADING...
            </div>
        </template>
    </div>
</template>

<script>
    import { onMounted, computed, ref } from "vue";
    import { useStore } from "vuex";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const store = useStore();
            const isInitialized = computed(() => store.state.appInitialized);

            const systemData = ref(null);

            const initializeAppData = async () => {
                await store.dispatch("initialize");
            };

            const getMemoryUsage = async () => {
                const response = await fetch("/data/system/memory-usage");
                const data = await response.json();

                const system = {
                    totalMemory: data.rss / (1024 * 1024),
                    heapSize: data.heapUsed / (1024 * 1024),
                    heapPercent: data.heapUsed / data.heapTotal,
                };

                systemData.value = system;

                setTimeout(() => getMemoryUsage(), 60000);
            };

            onMounted(async () => {
                await initializeAppData();
                await getMemoryUsage();
            });

            return {
                isInitialized,
                systemData,
            };
        },
    };
</script>

<style scoped>
    template { display: inline; }
    .app_component { padding: 0.5em; }
    /* .app_component >>> .class+id {} */
</style>
