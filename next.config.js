// next.config.js

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_VAPI_API_KEY: process.env.NEXT_PUBLIC_VAPI_API_KEY,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    // Removed the custom Webpack rule for pdf.worker.js and pdf.worker.mjs

    return config;
  },
  images: {
    domains: [
      'storage.googleapis.com',
      'firebasestorage.googleapis.com',
      'simplytalk-admin.appspot.com',
    ],
  },
  async headers() {
    return [
      {
        source: '/wavtools/worklets/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
