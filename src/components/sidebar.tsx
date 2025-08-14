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
  Settings
} from 'lucide-react'

interface SidebarProps {
  collapsed?: boolean
}

const navigation = [
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
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn(
      'flex flex-col h-full transition-all duration-300 ease-in-out border-r border-border',
      'bg-[#0061d5]', // Box blue background
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

      {/* Navigation */}
      <nav className="flex-1 px-2 pb-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex transition-all duration-200 rounded-md',
                collapsed 
                  ? 'flex-col items-center px-2 py-3 text-xs' 
                  : 'items-center px-3 py-3 text-sm',
                isActive
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/90 hover:bg-white/10 hover:text-white'
              )}
            >
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
            </Link>
          )
        })}
      </nav>
    </div>
  )
} 