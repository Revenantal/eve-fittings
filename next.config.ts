import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.evetech.net"
      }
    ]
  }
};

export default nextConfig;
