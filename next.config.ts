import type { NextConfig } from "next";
import path from "path";

process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES ??= path.join(process.cwd(), "next-font-mocked-responses.cjs");

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
