import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Type checking enabled - all TypeScript errors must be fixed
    ignoreBuildErrors: false,
  },
  eslint: {
    // ESLint enabled - all linting errors must be fixed  
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
