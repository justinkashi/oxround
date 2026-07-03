/** @type {import('next').NextConfig} */
const nextConfig = {
  // DEMO_EXPORT=1 → static export (public Cloudflare Pages demo, no backend).
  // Unset → normal server build (production deployment with Supabase).
  ...(process.env.DEMO_EXPORT ? { output: "export" } : {}),
};
export default nextConfig;
