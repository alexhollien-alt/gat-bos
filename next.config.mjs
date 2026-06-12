/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Cutover 2026-06-11: old (app) UI removed; the four (gatbos) screens are
    // the app. Old bookmarks land on the nearest new screen (308).
    const toToday = ['/dashboard', '/today-v2', '/morning', '/captures', '/inbox', '/actions', '/analytics'];
    const toPeople = ['/contacts', '/opportunities'];
    const toMarketing = ['/blasts', '/campaigns', '/drafts', '/materials', '/material-requests', '/tickets', '/weekly-edge', '/projects'];
    return [
      {
        source: '/follow-ups',
        destination: '/tasks?type=follow_up',
        permanent: true,
      },
      // /new/* was the pre-cutover home of the live screens.
      { source: '/new', destination: '/today', permanent: true },
      { source: '/new/:path*', destination: '/:path*', permanent: true },
      ...toToday.map((source) => ({ source, destination: '/today', permanent: true })),
      ...toToday.map((source) => ({ source: `${source}/:path*`, destination: '/today', permanent: true })),
      ...toPeople.map((source) => ({ source, destination: '/people', permanent: true })),
      ...toPeople.map((source) => ({ source: `${source}/:path*`, destination: '/people', permanent: true })),
      ...toMarketing.map((source) => ({ source, destination: '/marketing', permanent: true })),
      ...toMarketing.map((source) => ({ source: `${source}/:path*`, destination: '/marketing', permanent: true })),
    ];
  },
};

export default nextConfig;
