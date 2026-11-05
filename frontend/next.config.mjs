import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/**
 * 构建 worker 并发数。Next 默认按 CPU 核数并行编译页面，2C4G 以下机器上
 * 「webpack + tsc 类型检查」两个进程叠加会把内存打满（表现为构建日志
 * 最后一行 Killed、exit code 137）。容器构建时由 Dockerfile 传入 1。
 */
const buildCpus = Number(process.env.NEXT_BUILD_CPUS);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 曾经开过 output: 'standalone'，但运行期走的是 `next start`（原因见
  // frontend/Dockerfile 文件头），standalone 产物每次构建都会被删掉。
  // 关掉它可以省去一次全量文件追踪，构建更快、内存峰值更低。
  experimental: Number.isFinite(buildCpus) && buildCpus > 0 ? { cpus: buildCpus } : {},
  // 最后手段：内存极度紧张的机器上（<2G 且无法加 swap），可显式设置
  // NEXT_SKIP_TYPECHECK=1 跳过 next build 内的 tsc。默认关闭，类型检查
  // 仍作为构建的一部分执行；开启时请改为在 CI / 本地单独跑 `tsc --noEmit`。
  ...(process.env.NEXT_SKIP_TYPECHECK === '1'
    ? { typescript: { ignoreBuildErrors: true } }
    : {}),
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
