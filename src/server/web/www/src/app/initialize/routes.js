// Import page modules

const HomePage = () => import("@src/app/pages/home/home.vue");

const DNSHistoryPage = () => import("@src/app/pages/history/dns-history.vue");

const DhcpHistoryPage = () => import("@src/app/pages/history/dhcp-history.vue");

// [NEW IMPORT REGISTRATION]

let routes = [];


// Register routes

routes.push({ path: "/", name: "home", meta: { title: "Home" }, component: HomePage });

routes.push({ path: "/dns-history/:ipAddress?", name: "dns-history", meta: { title: "DNS History" }, component: DNSHistoryPage });

routes.push({ path: "/dhcp-history/:clientId?", name: "dhcp-history", meta: { title: "Dhcp History" }, component: DhcpHistoryPage });

// [NEW ROUTER REGISTRATION]

export {
    routes,
};
