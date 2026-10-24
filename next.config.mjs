/** @type {import('next').NextConfig} */
const extraDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const nextConfig = {
  ...(process.env.CAPACITOR_BUILD === '1' ? { output: 'export' } : {}),
  allowedDevOrigins: ["10.40.7.229", "127.0.0.1", ...extraDevOrigins],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
