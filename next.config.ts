import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Domain logic and jobs import server-only packages; keep them external so
  // Next doesn't try to bundle them.
  //
  // better-auth is deliberately NOT in this list. It ships `better-auth/react`,
  // whose hooks run while server-rendering a client component — and an external
  // package is resolved outside the bundle, where it picks up a null React.
  // Listing it here produced "Invalid hook call … reading 'useRef'" on every
  // page that used useSession, with no hint that the config was the cause.
  serverExternalPackages: ["bullmq", "ioredis", "@prisma/client"],
  // NOTE: switch to output: "standalone" in a later phase for a smaller image
  // once the migrate step is moved to a dedicated init container.
};

export default nextConfig;
