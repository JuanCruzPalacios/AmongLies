import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@amonglies/shared"],
  output: "standalone", // servidor autocontenido para el deploy en Render
};

export default nextConfig;
