import path from "path";

process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES ??= path.join(process.cwd(), "next-font-mocked-responses.cjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
