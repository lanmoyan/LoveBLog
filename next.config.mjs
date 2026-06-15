import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const buildCpus = Number(process.env.NEXT_BUILD_CPUS || 1);
const skipBuildTypecheck = process.env.SKIP_BUILD_TYPECHECK === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  trailingSlash: true,
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    cpus: Number.isFinite(buildCpus) && buildCpus > 0 ? buildCpus : 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 25
  },
  typescript: {
    ignoreBuildErrors: skipBuildTypecheck
  },
  turbopack: {
    root
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/uploads/:path*', destination: '/api/uploads/:path*' }
      ]
    };
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: '**' },
      { protocol: 'https', hostname: '**' }
    ]
  }
};

export default nextConfig;
