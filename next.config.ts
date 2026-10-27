import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: "/residence-principale", permanent: false }]
  },
}

export default nextConfig
