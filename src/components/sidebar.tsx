'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BoxLogo } from '@/components/box-logo'
import {
  Home,
  FileText,
  Database,
  Settings,
  BookOpen,
  ExternalLink,
  Moon,
  Sun
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface SidebarProps {
  collapsed?: boolean
}

interface NavigationItem {
  name: string
  href: string
  icon: any
  external?: boolean
}

const navigation: NavigationItem[] = [
  {
    name: 'Home',
    href: '/',
    icon: Home,
  },
  {
    name: 'Templates',
    href: '/templates',
    icon: FileText,
  },
  {
    name: 'Ground Truth',
    href: '/ground-truth',
    icon: Database,
  },
  {
    name: 'Library',
    href: '/library',
    icon: BookOpen,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

// External link moved to separate section
const externalLink = {
  name: 'Link to PPP',
  href: 'https://pcboxdemo.github.io/metadata/index_oauth.html',
  icon: ExternalLink,
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className={cn(
      'flex flex-col h-full transition-all duration-300 ease-in-out border-r border-border',
      'bg-[#0061d5] dark:bg-[#0a1929]', // Box blue background, darker navy in dark mode
      collapsed ? 'w-24' : 'w-64'
    )}>
      {/* Header with Logo */}
      <div className={cn(
        'flex items-center p-4 pt-8 pb-6',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        <div className={cn(
          'flex items-center',
          collapsed ? 'flex-col space-y-1' : 'space-x-3'
        )}>
          <BoxLogo className="text-white" size="md" />
          {!collapsed && (
            <span className="font-semibold text-white text-lg">
              box
            </span>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2 pt-2 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const linkClassName = cn(
            'group flex transition-all duration-200 rounded-md',
            collapsed 
              ? 'flex-col items-center px-2 py-3 text-xs' 
              : 'items-center px-3 py-3 text-sm',
            isActive
              ? 'bg-white/20 text-white shadow-sm'
              : 'text-white/90 hover:bg-white/10 hover:text-white'
          )
          
          const content = (
            <>
              <item.icon 
                className={cn(
                  'flex-shrink-0 text-white',
                  collapsed ? 'h-5 w-5 mb-1' : 'h-5 w-5 mr-3'
                )} 
              />
              <span className={cn(
                'font-medium text-white',
                collapsed ? 'text-xs text-center leading-tight whitespace-normal break-words' : 'text-sm'
              )}>
                {item.name}
              </span>
            </>
          )

          return (
            <Link
              key={item.name}
              href={item.href}
              className={linkClassName}
            >
              {content}
            </Link>
          )
        })}
      </nav>

      {/* Separator */}
      <div className="px-4 py-2">
        <div className="border-t border-white/20"></div>
      </div>

      {/* Theme Toggle Section */}
      <div className="px-2 pb-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          disabled={!mounted}
          className={cn(
            'group flex transition-all duration-200 rounded-md w-full',
            collapsed 
              ? 'flex-col items-center px-2 py-3 text-xs' 
              : 'items-center px-3 py-3 text-sm',
            'text-white/90 hover:bg-white/10 hover:text-white',
            !mounted && 'opacity-50 cursor-not-allowed'
          )}
          title={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Loading...'}
        >
          <div className={cn(
            'relative flex-shrink-0',
            collapsed ? 'h-5 w-5 mb-1' : 'h-5 w-5 mr-3'
          )}>
            <Sun className={cn(
              'absolute h-5 w-5 text-white rotate-0 scale-100 transition-all',
              'dark:-rotate-90 dark:scale-0'
            )} />
            <Moon className={cn(
              'absolute h-5 w-5 text-white rotate-90 scale-0 transition-all',
              'dark:rotate-0 dark:scale-100'
            )} />
          </div>
          {!collapsed && (
            <span className="font-medium text-white text-sm">
              Change Theme
            </span>
          )}
          {collapsed && (
            <span className="font-medium text-white text-xs text-center leading-tight whitespace-normal break-words">
              Theme
            </span>
          )}
        </button>
      </div>

      {/* External Links Section */}
      <div className="px-2 pb-4">
        <a
          href={externalLink.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'group flex transition-all duration-200 rounded-md',
            collapsed 
              ? 'flex-col items-center px-2 py-3 text-xs' 
              : 'items-center px-3 py-3 text-sm',
            'text-white/90 hover:bg-white/10 hover:text-white'
          )}
        >
          <ExternalLink 
            className={cn(
              'flex-shrink-0 text-white',
              collapsed ? 'h-5 w-5 mb-1' : 'h-5 w-5 mr-3'
            )} 
          />
          <span className={cn(
            'font-medium text-white',
            collapsed ? 'text-xs text-center leading-tight whitespace-normal break-words' : 'text-sm'
          )}>
            {externalLink.name}
          </span>
        </a>
      </div>
    </div>
  )
} 