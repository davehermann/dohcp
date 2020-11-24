import { defineAsyncComponent } from "vue";

const appRoot = defineAsyncComponent(() => import("@src/app/components/base/app.vue"));

function Register(context) {

    context.component("history-ips", defineAsyncComponent(() => import("@src/app/components/ips/history-ips.vue")));

    context.component("dhcp-history-clients", defineAsyncComponent(() => import("@src/app/components/history/dhcp-history-clients.vue")));

    context.component("dhcp-history-for-client", defineAsyncComponent(() => import("@src/app/components/history/dhcp-history-for-client.vue")));

    context.component("dhcp-message-summary", defineAsyncComponent(() => import("@src/app/components/history/dhcp-message-summary.vue")));

    // [NEW IMPORT REGISTRATION]
}

export {
    appRoot,
    Register,
};
