import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@starter/scoring"],
  // Backup imports send the file text to a server action (up to 5 MB); the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
