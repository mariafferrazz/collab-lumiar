import type { NextConfig } from "next";

const requestedDistDir = process.env.COLLAB_NEXT_DIST_DIR?.trim();

if (
  requestedDistDir &&
  !/^\.next-performance-[a-z0-9-]+$/.test(requestedDistDir)
) {
  throw new Error(
    "COLLAB_NEXT_DIST_DIR deve usar o formato .next-performance-<nome>.",
  );
}

const nextConfig: NextConfig = {
  ...(requestedDistDir ? { distDir: requestedDistDir } : {}),
  cacheComponents: true,
  partialPrefetching: true,
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
