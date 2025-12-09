import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Type checking enabled - all TypeScript errors must be fixed
    ignoreBuildErrors: false,
  },
  // Note: eslint config removed in Next.js 16 - ESLint runs separately via npm run lint
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
