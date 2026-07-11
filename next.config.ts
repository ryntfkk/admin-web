import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // @ts-ignore
  allowedDevOrigins: ['192.168.0.127', 'localhost'],
};

export default nextConfig;
