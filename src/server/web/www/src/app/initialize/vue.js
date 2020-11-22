import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { store } from "./store/store";

import { routes } from "./routes.js";
import { appRoot, Register as RegisterComponents } from "./components";

// Create the router
const router = createRouter({
    history: createWebHistory(),
    routes,
});

const app = createApp(appRoot);
RegisterComponents(app);
app.use(router);
app.use(store);
app.mount("#app_holder");

router.replace({ name: "home" });

// RUN HOT MODULE REPLACEMENT IN DEVELOPMENT.
// REMOVE FOR PRODUCTION
console.warn(`Snowpack HMR code in frontend app/initialize/vue.js: remove for production`);
// Documentation: https://www.snowpack.dev/#hot-module-replacement
if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
      app.unmount();
    });
}
