import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@limit-canvas/hook-dsl",
    "@limit-canvas/lop-sdk",
    "@limit-canvas/codegen",
  ],
};

export default nextConfig;
