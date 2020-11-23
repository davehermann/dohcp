import { defineAsyncComponent } from "vue";

const appRoot = defineAsyncComponent(() => import("@src/app/components/base/app.vue"));

function Register(context) {

    context.component("history-ips", defineAsyncComponent(() => import("@src/app/components/ips/history-ips.vue")));

    // [NEW IMPORT REGISTRATION]
}

export {
    appRoot,
    Register,
};
