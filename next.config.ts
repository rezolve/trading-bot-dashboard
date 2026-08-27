import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SSR mode for Vercel deployment
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
