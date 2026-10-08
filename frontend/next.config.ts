import type { NextConfig } from "next";

// Every page in NexusCX shows data for the signed-in user, so pages are
// rendered per request. Cache Components is switched off to keep that simple.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
