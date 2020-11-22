import { defineAsyncComponent } from "vue";

const appRoot = defineAsyncComponent(() => import("@src/app/components/base/app.vue"));

function Register(context) {

    // [NEW IMPORT REGISTRATION]
}

export {
    appRoot,
    Register,
};
