# Light/Dark Theme Implementation Plan

## ✅ Current Status

**Good news - you already have:**
- ✅ `next-themes` (v0.4.6) installed
- ✅ Tailwind configured with `darkMode: ['class']`
- ✅ CSS variables for theming set up
- ✅ `suppressHydrationWarning` in layout

## 🎯 Implementation Plan

### Step 1: Create Theme Provider Component
**File:** `src/components/theme-provider.tsx`

Create a wrapper for `next-themes` ThemeProvider.

**Effort:** 5 minutes

---

### Step 2: Add Theme Provider to Root Layout
**File:** `src/app/layout.tsx`

Wrap children with ThemeProvider (below the other providers).

**Effort:** 2 minutes

---

### Step 3: Create Theme Toggle Component
**File:** `src/components/theme-toggle.tsx`

Build a button component with moon/sun icons to toggle themes.

**Options:**
- **Simple:** Just a button with icon swap
- **Advanced:** Dropdown with Light/Dark/System options

**Effort:** 10 minutes (simple) | 20 minutes (advanced)

---

### Step 4: Add Theme Card to Home Page
**File:** `src/components/main-page-simplified.tsx`

Add a card between authentication section and templates section.

**Location:** After auth status, before template selection.

**Card Contents:**
- Title: "Appearance"
- Description: "Customize how the app looks"
- Theme toggle button/dropdown

**Effort:** 15 minutes

---

### Step 5: Update CSS Variables for Dark Mode
**File:** `src/app/globals.css`

Add dark mode color definitions (you may already have these).

**Effort:** 5 minutes (if needed)

---

### Step 6: Add Theme Toggle to Header (Optional)
**File:** `src/components/header.tsx`

Add theme toggle to the app header for quick access.

**Effort:** 5 minutes

---

## 📋 Detailed Steps

### Step 1: Theme Provider Component

```tsx
// src/components/theme-provider.tsx
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

---

### Step 2: Update Root Layout

```tsx
// src/app/layout.tsx
import { ThemeProvider } from '@/components/theme-provider';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PromptLibraryProvider>
            <AccuracyDataProvider>
              <GroundTruthProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
                <Toaster />
              </GroundTruthProvider>
            </AccuracyDataProvider>
          </PromptLibraryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

### Step 3: Theme Toggle Component (Advanced Version)

```tsx
// src/components/theme-toggle.tsx
'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Simple Version (just button):**

```tsx
// src/components/theme-toggle.tsx (Simple)
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

---

### Step 4: Theme Card Component

```tsx
// src/components/theme-card.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from './theme-toggle';
import { Palette } from 'lucide-react';

export function ThemeCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Appearance</CardTitle>
        </div>
        <ThemeToggle />
      </CardHeader>
      <CardContent>
        <CardDescription>
          Customize how the app looks and feels. Choose between light, dark, or system theme.
        </CardDescription>
      </CardContent>
    </Card>
  );
}
```

---

### Step 5: Add to Main Page

**Location in `main-page-simplified.tsx`:**

Find the section where you render auth status and templates. Add the ThemeCard between them.

```tsx
// In main-page-simplified.tsx
import { ThemeCard } from '@/components/theme-card';

// In the return statement, find where you show auth/templates
// Add ThemeCard like this:

return (
  <div className="flex h-screen">
    <DashboardSidebar {...sidebarProps} />
    
    <div className="flex-1 overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        
        {/* Auth Status Section */}
        {authStatus && (
          <Card>...</Card>
        )}
        
        {/* NEW: Theme Card */}
        <ThemeCard />
        
        {/* Templates Section */}
        {configuredTemplates && (
          <Card>...</Card>
        )}
        
        {/* Rest of your content */}
        
      </div>
    </div>
  </div>
);
```

---

### Step 6: Dark Mode CSS Variables (If Needed)

Check if `src/app/globals.css` has dark mode colors. If not, add:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* ... other light mode colors */
  }
 
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... other dark mode colors */
  }
}
```

---

## 🎨 Visual Placement

```
┌─────────────────────────────────────────┐
│  Header with App Title                  │
├─────────────────────────────────────────┤
│                                         │
│  📊 Authentication Status Card          │
│  └─ Connected as: user@example.com      │
│                                         │
│  🎨 Appearance Card (NEW!)              │
│  └─ Theme Toggle: [Light/Dark/System]  │
│                                         │
│  📋 Metadata Templates Card             │
│  └─ Template selection...               │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🚀 Execution Order

1. **Create files:**
   - `src/components/theme-provider.tsx`
   - `src/components/theme-toggle.tsx`
   - `src/components/theme-card.tsx`

2. **Update files:**
   - `src/app/layout.tsx` - Add ThemeProvider
   - `src/components/main-page-simplified.tsx` - Add ThemeCard
   - `src/app/globals.css` - Verify dark mode colors

3. **Test:**
   - Toggle between light/dark
   - Check if colors update properly
   - Test system theme preference

---

## ⏱️ Total Time Estimate

- **Minimum (simple toggle):** ~30 minutes
- **Full implementation (with dropdown):** ~45 minutes
- **With refinements and testing:** ~1 hour

---

## 🎯 Success Criteria

- ✅ Theme persists across page reloads
- ✅ System theme preference works
- ✅ All components look good in both themes
- ✅ No flash of unstyled content on load
- ✅ Smooth transitions between themes

---

## 📚 Resources

- [next-themes documentation](https://github.com/pacocoursey/next-themes)
- [Tailwind Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [shadcn/ui Theme docs](https://ui.shadcn.com/docs/dark-mode)

---

**Ready to implement? I can create all these files for you right now!**

