import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  transpilePackages: ["@homeboard/core", "@homeboard/intents"],
};

export default withSerwist(nextConfig);
