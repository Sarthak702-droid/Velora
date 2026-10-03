import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@velora/ui", "@velora/types", "@velora/validation"],
  devIndicators: false,
};
export default config;
