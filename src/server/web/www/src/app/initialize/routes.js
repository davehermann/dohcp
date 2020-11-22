// Import page modules

const HomePage = () => import("@src/app/pages/home/home.vue");

// [NEW IMPORT REGISTRATION]

let routes = [];


// Register routes

routes.push({ path: "/", name: "home", meta: { title: "Home" }, component: HomePage });

// [NEW ROUTER REGISTRATION]

export {
    routes,
};
