import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@velora/ui", "@velora/types", "@velora/validation"],
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default config;
