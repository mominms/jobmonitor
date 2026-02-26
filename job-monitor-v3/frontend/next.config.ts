import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow all local network IPs for dev server access
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    }
  },
  // Explicitly allow mobile device origin for dev server
  // Note: This matches the user's reported IP.
  // In a real prod setup, we wouldn't hardcode these.
  allowedDevOrigins: ["192.168.1.109", "localhost"],
};

export default nextConfig;
