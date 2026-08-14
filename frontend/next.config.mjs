/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        // 本地 dev 默认直连 localhost:3001；Docker 内通过 API_PROXY_TARGET 指向 backend 服务名
        destination: process.env.API_PROXY_TARGET || 'http://localhost:3001/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
