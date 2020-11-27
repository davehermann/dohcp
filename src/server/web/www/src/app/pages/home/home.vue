<template>
    <div class="home_page">
        <p>
            <router-link :to="{ name: 'dhcp-leases' }">DHCP Leases</router-link>
        </p>
        <p>
            <router-link :to="{ name: 'dhcp-history' }">DHCP Request History</router-link>
        </p>
        <p>
            <router-link :to="{ name: 'dns-cache' }">DNS Cache</router-link>
        </p>
        <p>
            <router-link :to="{ name: 'dns-history' }">DNS Request History</router-link>
        </p>
    </div>
</template>

<script>
    export default {
        // props: {},
        // setup(/*props, { attrs, slots, emit }*/) {},
    };
</script>

<style scoped>
    /* .home_page {} */
    /* .home_page >>> .class+id {} */
</style>
