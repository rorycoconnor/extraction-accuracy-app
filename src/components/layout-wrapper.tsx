'use client'

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  
  // Full width for home page, normal padding for other pages
  const isHomePage = pathname === '/';
  const mainClassName = isHomePage 
    ? "flex-1 flex flex-col overflow-hidden"
    : "flex-1 flex flex-col gap-4 p-4 md:gap-8 md:p-8 overflow-auto";

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Always collapsed */}
      <Sidebar collapsed={true} />
      
      {/* Main Content - Conditional padding based on page */}
      <main className={mainClassName}>
        {children}
      </main>
    </div>
  );
} 