import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { forceSwcTransforms: true },
}

export default nextConfig
