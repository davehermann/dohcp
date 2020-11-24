import { defineAsyncComponent } from "vue";

const appRoot = defineAsyncComponent(() => import("@src/app/components/base/app.vue"));

function Register(context) {

    context.component("history-ips", defineAsyncComponent(() => import("@src/app/components/ips/history-ips.vue")));

    context.component("dhcp-history-clients", defineAsyncComponent(() => import("@src/app/components/history/dhcp/clients.vue")));

    context.component("dhcp-history-for-client", defineAsyncComponent(() => import("@src/app/components/history/dhcp/for-client.vue")));

    context.component("dhcp-message-summary", defineAsyncComponent(() => import("@src/app/components/history/dhcp/message-summary.vue")));

    context.component("dns-history-clients", defineAsyncComponent(() => import("@src/app/components/history/dns/clients.vue")));

    context.component("dns-history-for-client", defineAsyncComponent(() => import("@src/app/components/history/dns/for-client.vue")));

    // [NEW IMPORT REGISTRATION]
}

export {
    appRoot,
    Register,
};
