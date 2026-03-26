import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  experimental: {
    turbo: {
      resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    },
  },
};

export default nextConfig;
