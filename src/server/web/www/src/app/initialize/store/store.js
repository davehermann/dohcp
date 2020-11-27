// Modules are included in the store
// Sub-modules can be included in each module's store

import { createStore } from "vuex";

// Modules
// [NEW IMPORT REGISTRATION]

const state = {
    appInitialized: false,
};

const mutations = {
    isInitialized (state) {
        state.appInitialized = true;
    },
};

const actions = {
    async initialize ({ commit }) {
        // Load initial data here
        await new Promise(resolve => {
            commit("isInitialized");
            resolve();
        });
    },
};

const modules = {
    // [NEW MODULE REGISTRATION]
};

const store = createStore({
    state,
    mutations,
    actions,
    modules,
});

export {
    store,
};
