/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Default de Next es 1MB — insuficiente para subir clips de video cortos
  // del carrusel vía Server Action (uploadSiteMedia). Las imágenes (mucho
  // más livianas) siguen funcionando igual, este límite solo sube el techo.
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  images: {
    unoptimized: true,
     remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'rtmuaeonmqadbezygfrv.supabase.co' },
    ],
  },
   webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        path: false,
        stream: false,
      }
    }
    return config
  }
}

export default nextConfig