import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurações para reduzir warnings
  serverExternalPackages: ['@supabase/supabase-js'],
  
  // Configurações para reduzir warnings de webpack
  webpack: (config, { isServer, dev }) => {
    // Configurações específicas para reduzir warnings
    if (!isServer && !dev) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  }
};

export default nextConfig;
