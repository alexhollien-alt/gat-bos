/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/follow-ups',
        destination: '/tasks?type=follow_up',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
