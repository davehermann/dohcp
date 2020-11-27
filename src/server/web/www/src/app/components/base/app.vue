<template>
    <div class="app_component">
        <div class="row">
            <h1 class="grow is-size-3">DoHCP Status</h1>
            <div v-if="!!systemData" class="is-size-7">
                <p>
                    Uptime: {{systemData.uptime}}
                </p>
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

            const getSystemStats = async () => {
                const response = await fetch("/data/system/stats");
                const data = await response.json();

                const serviceStarted = new Date(data.startTime);
                // Convert to the smallest block of days, hours, minutes, seconds
                let totalSeconds = Math.floor((new Date().getTime() - serviceStarted.getTime()) / 1000);

                let totalMinutes = Math.floor(totalSeconds / 60);
                totalSeconds -= (totalMinutes * 60);

                let totalHours = Math.floor(totalMinutes / 60);
                totalMinutes -= (totalHours * 60);

                let totalDays = Math.floor(totalHours / 24);
                totalHours -= (totalDays * 24);

                let timeParts = [];

                if (totalDays > 0) timeParts.push(totalDays + " Day" + (totalDays === 1 ? "" : "s"));
                if (totalHours > 0) timeParts.push(totalHours + " Hour" + (totalHours === 1 ? "" : "s"));
                if (totalMinutes > 0) timeParts.push(totalMinutes + " Minute" + (totalMinutes === 1 ? "" : "s"));
                if (totalSeconds > 0) timeParts.push(totalSeconds + " Second" + (totalSeconds === 1 ? "" : "s"));

                const system = {
                    uptime: timeParts.join(", "),
                    totalMemory: data.memory.rss / (1024 * 1024),
                    heapSize: data.memory.heapUsed / (1024 * 1024),
                    heapPercent: data.memory.heapUsed / data.memory.heapTotal,
                };

                systemData.value = system;

                setTimeout(() => getSystemStats(), 60000);
            };

            onMounted(async () => {
                await initializeAppData();
                await getSystemStats();
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
