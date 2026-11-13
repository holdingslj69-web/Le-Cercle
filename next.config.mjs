/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "localhost";
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: supabaseHost }] },
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default nextConfig;
