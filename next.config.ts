import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Domain logic and jobs import server-only packages; keep them external so
  // Next doesn't try to bundle them.
  serverExternalPackages: ["bullmq", "ioredis", "@prisma/client", "better-auth"],
  // NOTE: switch to output: "standalone" in a later phase for a smaller image
  // once the migrate step is moved to a dedicated init container.
};

export default nextConfig;
