<template>
    <div class="app_component">
        <h1>DoHCP Status</h1>
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
    import { onMounted, computed } from "vue";
    import { useStore } from "vuex";

    export default {
        // props: {},
        setup(/*props, { attrs, slots, emit }*/) {
            const store = useStore();
            const isInitialized = computed(() => store.state.appInitialized);

            const initializeAppData = async () => {
                await store.dispatch("initialize");
            };

            onMounted(async () => {
                await initializeAppData();
            });

            return {
                isInitialized,
            };
        },
    };
</script>

<style scoped>
    template { display: inline; }
    /* .app_component {} */
    /* .app_component >>> .class+id {} */
</style>
