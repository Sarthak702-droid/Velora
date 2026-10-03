import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@velora/ui", "@velora/types", "@velora/validation"],
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:4000/api/v1/:path*",
      },
    ];
  },
};
export default config;
