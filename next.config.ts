import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    '/blog': ['./content/blog/**/*'],
    '/blog/[slug]': ['./content/blog/**/*'],
    '/blog/[slug]/opengraph-image': ['./content/blog/**/*'],
    '/sitemap.xml': ['./content/blog/**/*'],
    '/api/platform/superadmin/blog': ['./content/blog/**/*'],
    '/api/platform/superadmin/blog/send': ['./content/blog/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;



