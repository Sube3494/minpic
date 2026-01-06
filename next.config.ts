/*
 * @Date: 2026-01-04 22:22:40
 * @Author: Sube
 * @FilePath: next.config.ts
 * @LastEditTime: 2026-01-06 14:53:59
 * @Description: 
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
