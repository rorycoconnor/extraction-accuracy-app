# Theme System Quick Start Guide

## 🚀 Get Started in 15 Minutes

This guide will get light, dark, and purple themes working in your app quickly.

---

## Step 1: Install Dependencies (1 min)

```bash
npm install next-themes
```

---

## Step 2: Create Theme Provider (3 min)

Create `src/providers/theme-provider.tsx`:

```tsx
'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes/dist/types'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      themes={['light', 'dark', 'purple']}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
```

---

## Step 3: Update Layout (2 min)

Update `src/app/layout.tsx`:

```tsx
import { ThemeProvider } from '@/providers/theme-provider'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* existing head content */}
      </head>
      <body className="font-body antialiased">
        <ThemeProvider>
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

**Note:** Remove `bg-gray-50 dark:bg-gray-900` from body className

---

## Step 4: Add Purple Theme CSS (5 min)

Add to `src/app/globals.css` after the `.dark` class:

```css
.purple {
  --background: 260 35% 12%;
  --foreground: 280 20% 95%;
  --card: 260 30% 15%;
  --card-foreground: 280 20% 95%;
  --popover: 260 30% 15%;
  --popover-foreground: 280 20% 95%;
  --primary: 265 75% 65%;
  --primary-foreground: 0 0% 100%;
  --secondary: 260 25% 22%;
  --secondary-foreground: 280 20% 90%;
  --muted: 260 25% 20%;
  --muted-foreground: 265 15% 60%;
  --accent: 270 70% 70%;
  --accent-foreground: 260 35% 12%;
  --destructive: 0 62.8% 50%;
  --destructive-foreground: 280 20% 95%;
  --border: 260 25% 25%;
  --input: 260 25% 22%;
  --ring: 265 75% 65%;
  --chart-1: 265 75% 65%;
  --chart-2: 290 70% 70%;
  --chart-3: 240 70% 65%;
  --chart-4: 280 65% 70%;
  --chart-5: 250 70% 68%;
  --sidebar-background: 260 30% 14%;
  --sidebar-foreground: 280 20% 90%;
  --sidebar-primary: 265 75% 65%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 260 25% 20%;
  --sidebar-accent-foreground: 280 20% 90%;
  --sidebar-border: 260 25% 22%;
  --sidebar-ring: 265 75% 65%;
}
```

**Also add smooth transitions** (add after `@layer base`):

```css
@layer base {
  * {
    @apply transition-colors duration-200;
  }
}
```

---

## Step 5: Create Theme Switcher (4 min)

Create `src/components/theme-switcher.tsx`:

```tsx
'use client'

import * as React from 'react'
import { Moon, Sun, Sparkles } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 purple:-rotate-90 purple:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 purple:rotate-0 purple:scale-0" />
          <Sparkles className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all purple:rotate-0 purple:scale-100" />
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
        <DropdownMenuItem onClick={() => setTheme('purple')}>
          <Sparkles className="mr-2 h-4 w-4" />
          <span>Purple</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Note:** The purple class selectors will need custom Tailwind plugin or just use the transitions from dark mode.

**Simplified version (recommended):**

```tsx
'use client'

import * as React from 'react'
import { Moon, Sun, Sparkles } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const getIcon = () => {
    if (theme === 'light') return <Sun className="h-4 w-4" />
    if (theme === 'dark') return <Moon className="h-4 w-4" />
    if (theme === 'purple') return <Sparkles className="h-4 w-4" />
    return <Sun className="h-4 w-4" />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {getIcon()}
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
        <DropdownMenuItem onClick={() => setTheme('purple')}>
          <Sparkles className="mr-2 h-4 w-4" />
          <span>Purple</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## Step 6: Add to Your UI

### Option A: Add to Header

Update `src/components/header.tsx` or wherever you want it:

```tsx
import { ThemeSwitcher } from '@/components/theme-switcher'

export default function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <h1>Box Accuracy App</h1>
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        {/* other header items */}
      </div>
    </header>
  )
}
```

### Option B: Add to Sidebar

Update `src/components/sidebar.tsx`:

```tsx
import { ThemeSwitcher } from '@/components/theme-switcher'

export function Sidebar() {
  return (
    <aside>
      {/* navigation items */}
      <div className="mt-auto p-4">
        <ThemeSwitcher />
      </div>
    </aside>
  )
}
```

---

## Step 7: Test! 🎉

```bash
npm run dev
```

Visit http://localhost:9002 and:

1. ✅ Click the theme switcher
2. ✅ Try all three themes
3. ✅ Refresh the page (theme should persist)
4. ✅ Check different components

---

## Troubleshooting

### Theme doesn't persist on refresh
- Check that `next-themes` is installed
- Ensure `ThemeProvider` wraps your app in layout.tsx
- Check browser localStorage for theme preference

### Flash of wrong theme on load
- Make sure `suppressHydrationWarning` is on `<html>` tag
- Consider adding theme script to head (see advanced guide)

### Purple theme not applying
- Verify `.purple` class is in globals.css
- Check that `themes={['light', 'dark', 'purple']}` is in ThemeProvider
- Inspect element to see if class is applied to `<html>` tag

### Icons not showing in theme switcher
- Ensure `lucide-react` is installed
- Check imports in theme-switcher.tsx
- Try the simplified version without animations

---

## Next Steps

### Immediate Improvements
1. Add theme switcher to all relevant pages
2. Test all components in all three themes
3. Adjust purple colors if needed
4. Add tooltips/labels for better UX

### Future Enhancements
- Add more theme variants
- Theme preview before switching
- Time-based auto theme switching
- User custom themes

---

## Complete File Checklist

- [ ] `package.json` - next-themes installed
- [ ] `src/providers/theme-provider.tsx` - created
- [ ] `src/app/layout.tsx` - ThemeProvider added, body classes updated
- [ ] `src/app/globals.css` - purple theme added, transitions added
- [ ] `src/components/theme-switcher.tsx` - created
- [ ] Header/Sidebar - theme switcher integrated
- [ ] Tested all three themes
- [ ] Verified persistence works
- [ ] Checked accessibility

---

## Resources

- [next-themes documentation](https://github.com/pacocoursey/next-themes)
- [Full Implementation Plan](./THEME_SYSTEM_IMPLEMENTATION_PLAN.md)
- [UI Mockups](./THEME_MOCKUPS.md)

---

## Need Help?

Common issues and solutions:
- **TypeScript errors**: Add `'use client'` to top of theme-switcher.tsx
- **Hydration errors**: Ensure suppressHydrationWarning is set
- **Styling issues**: Check that you're using CSS variables, not hardcoded colors
- **Performance issues**: Theme switching should be < 100ms, check for unnecessary re-renders

---

🎨 **Enjoy your new themes!** Start with light, switch to dark for late night work, or try purple when you want something unique and creative!
