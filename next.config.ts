import type { NextConfig } from "next";

const carPhotoRemotePatterns = (() => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const bucket = process.env.SUPABASE_CAR_PHOTO_BUCKET;
  if (!supabaseUrl || !bucket) return [];
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:") return [];
    return [{
      protocol: "https" as const,
      hostname: url.hostname,
      port: url.port,
      pathname: `/storage/v1/object/public/${encodeURIComponent(bucket)}/**`,
    }];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  // Allow development assets when testing the app on a phone over the LAN.
  allowedDevOrigins: ["192.168.1.101"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: { remotePatterns: carPhotoRemotePatterns, qualities: [60, 75] },
};

export default nextConfig;
