import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // pdfjs-dist (v4+) 为 ESM-only，源码含 import.meta。让 Next 把它当应用 ESM
  // 图的一部分编译，产出的 chunk 是模块，import.meta 合法，SWC 压缩不再报错。
  // worker 不在此 bundle：由 viewer 通过 public/ 静态路径加载，避免被内联压缩。
  transpilePackages: ['@open-file-viewer/core', '@open-file-viewer/react', 'pdfjs-dist'],
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || 'http://localhost:4001';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${target}/api/v1/:path*`,
      },
    ];
  },
};

export default withPWA(nextConfig);
