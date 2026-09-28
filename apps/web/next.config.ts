import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  transpilePackages: ["@homeboard/core", "@homeboard/intents"],
  // La vista del televisore si chiamava /tv: i kiosk già configurati arrivano comunque a /casa, con i parametri.
  redirects: async () => [{ source: "/tv", destination: "/casa", permanent: false }],
};

export default withSerwist(nextConfig);
