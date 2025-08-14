import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { LayoutWrapper } from '@/components/layout-wrapper';
import { GroundTruthProvider } from '@/hooks/use-ground-truth';
import { AccuracyDataProvider } from '@/store/AccuracyDataStore';

export const metadata: Metadata = {
  title: 'Box Accuracy App',
  description: 'Evaluate metadata extraction from documents.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-gray-50 dark:bg-gray-900">
        <AccuracyDataProvider>
          <GroundTruthProvider>
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
            <Toaster />
          </GroundTruthProvider>
        </AccuracyDataProvider>
      </body>
    </html>
  );
}
