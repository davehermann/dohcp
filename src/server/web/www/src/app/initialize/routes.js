// Import page modules

const HomePage = () => import("@src/app/pages/home/home.vue");

const DNSHistoryPage = () => import("@src/app/pages/history/dns-history.vue");

// [NEW IMPORT REGISTRATION]

let routes = [];


// Register routes

routes.push({ path: "/", name: "home", meta: { title: "Home" }, component: HomePage });

routes.push({ path: "/dns-history", name: "dns-history", meta: { title: "DNS History" }, component: DNSHistoryPage });

// [NEW ROUTER REGISTRATION]

export {
    routes,
};
