// Import page modules

const HomePage = () => import("@src/app/pages/home/home.vue");

const DNSHistoryPage = () => import("@src/app/pages/history/dns-history.vue");

const DhcpHistoryPage = () => import("@src/app/pages/history/dhcp-history.vue");

const DhcpLeasesPage = () => import("@src/app/pages/dhcp/dhcp-leases.vue");

const DnsCachePage = () => import("@src/app/pages/dns/dns-cache.vue");

// [NEW IMPORT REGISTRATION]

let routes = [];


// Register routes

routes.push({ path: "/", name: "home", meta: { title: "Home" }, component: HomePage });

routes.push({ path: "/dns-history/:ipAddress?", name: "dns-history", meta: { title: "DNS History" }, component: DNSHistoryPage });

routes.push({ path: "/dhcp-history/:clientId?", name: "dhcp-history", meta: { title: "Dhcp History" }, component: DhcpHistoryPage });

routes.push({ path: "/dhcp/leases", name: "dhcp-leases", meta: { title: "Dhcp Leases" }, component: DhcpLeasesPage });

routes.push({ path: "/dns/cache", name: "dns-cache", meta: { title: "Dns Cache" }, component: DnsCachePage });

// [NEW ROUTER REGISTRATION]

export {
    routes,
};
