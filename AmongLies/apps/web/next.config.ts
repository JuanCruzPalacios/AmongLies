import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@amonglies/shared"],
  output: "standalone", // needed for Railway deployment
};

export default nextConfig;
