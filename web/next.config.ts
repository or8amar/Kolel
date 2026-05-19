import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow LAN / alternate host during `next dev` (Next.js 15 blocks cross-origin dev assets by default).
  allowedDevOrigins: [
    "localhost",
    "localhost:3000",
    "localhost:3001",
    "127.0.0.1",
    "127.0.0.1:3000",
    "127.0.0.1:3001",
    "192.168.50.31",
    "192.168.50.31:3001",
  ],
};

export default nextConfig;
