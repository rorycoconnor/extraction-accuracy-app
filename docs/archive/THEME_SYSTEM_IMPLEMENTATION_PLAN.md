# Theme System Implementation Plan

## Executive Summary
This plan outlines the implementation of a modern, flexible theme system supporting **Light Mode**, **Dark Mode**, and **Purple Mode** for the Box Accuracy App. The implementation leverages existing CSS variables, adds `next-themes` for seamless theme switching, and introduces a beautiful purple theme variant.

---

## Current State Analysis

### ✅ What We Have
- **Tailwind CSS** configured with `darkMode: ['class']`
- **CSS Variables** already defined for light and dark modes in `globals.css`
- **shadcn/ui components** that are theme-aware via CSS variables
- **suppressHydrationWarning** in layout (prepared for client-side theme switching)
- Modern UI with Inter and Space Grotesk fonts

### ❌ What's Missing
- No theme provider (next-themes)
- No theme switcher UI component
- No purple theme variant
- No persistence of user theme preference
- No smooth theme transitions

---

## Implementation Plan

### Phase 1: Foundation Setup (30 minutes)

#### 1.1 Install Dependencies
```bash
npm install next-themes
```

#### 1.2 Create Theme Provider
**File:** `src/providers/theme-provider.tsx`

A wrapper around `next-themes` that:
- Manages theme state (light, dark, purple)
- Persists user preference to localStorage
- Prevents hydration mismatch
- Provides theme context to all components

#### 1.3 Integrate Provider into Layout
Update `src/app/layout.tsx` to wrap the app with ThemeProvider

---

### Phase 2: Purple Theme Design (45 minutes)

#### 2.1 Define Purple Theme Colors
Add `.purple` class to `src/app/globals.css` with carefully designed purple-tinted color palette:

**Purple Mode Color Strategy:**
- **Primary**: Rich purple (#8B5CF6, #A78BFA) - vibrant but not overwhelming
- **Background**: Deep purple-gray (#1E1B2E) - comfortable for extended use
- **Accents**: Complementary purple shades for hierarchy
- **Contrast**: Ensure WCAG AA compliance for accessibility

**Color Palette:**
```css
.purple {
  /* Base colors with purple tint */
  --background: 260 35% 12%;        /* Deep purple-gray */
  --foreground: 280 20% 95%;        /* Light purple-white */
  
  /* Card and surfaces */
  --card: 260 30% 15%;
  --card-foreground: 280 20% 95%;
  
  /* Primary - Vibrant purple */
  --primary: 265 75% 65%;           /* Rich purple #8B5CF6 */
  --primary-foreground: 0 0% 100%;
  
  /* Secondary - Muted purple */
  --secondary: 260 25% 22%;
  --secondary-foreground: 280 20% 90%;
  
  /* Accent - Bright purple */
  --accent: 270 70% 70%;            /* Light purple #A78BFA */
  --accent-foreground: 260 35% 12%;
  
  /* Muted elements */
  --muted: 260 25% 20%;
  --muted-foreground: 265 15% 60%;
  
  /* Borders and inputs */
  --border: 260 25% 25%;
  --input: 260 25% 22%;
  --ring: 265 75% 65%;
  
  /* Sidebar specific */
  --sidebar-background: 260 30% 14%;
  --sidebar-foreground: 280 20% 90%;
  --sidebar-primary: 265 75% 65%;
  --sidebar-accent: 260 25% 20%;
  --sidebar-border: 260 25% 22%;
}
```

#### 2.2 Update Tailwind Config
Ensure Tailwind recognizes all three theme modes by updating `darkMode` configuration if needed.

---

### Phase 3: Theme Switcher Component (45 minutes)

#### 3.1 Create Theme Switcher Component
**File:** `src/components/theme-switcher.tsx`

**Features:**
- Beautiful dropdown with theme preview
- Icons for each theme (Sun ☀️, Moon 🌙, Sparkles ✨ for purple)
- Keyboard navigation support
- Smooth transition animations
- Visual indicator for current theme

**Design Options:**

**Option A: Dropdown Menu** (Recommended)
- Small button in header/sidebar
- Dropdown with three theme options
- Each option shows icon + label
- Current theme highlighted

**Option B: Toggle Button Group**
- Three segmented buttons
- Compact horizontal layout
- Visual feedback on selection

**Option C: Command Palette Integration**
- Add theme switching to command palette (Cmd+K)
- Keyboard-first approach

#### 3.2 Create Compact Icon Button Variant
For sidebar when collapsed - just cycles through themes on click

---

### Phase 4: Integration & Polish (30 minutes)

#### 4.1 Add Theme Switcher to Header
Place theme switcher in the header component for easy access

#### 4.2 Add Theme Switcher to Sidebar
Add to sidebar navigation items (works well with collapsed state)

#### 4.3 Add Theme Transition Animations
Add smooth CSS transitions for theme changes:
```css
* {
  transition: background-color 0.2s ease-in-out, 
              border-color 0.2s ease-in-out,
              color 0.2s ease-in-out;
}
```

#### 4.4 Update Body Background Classes
Remove hardcoded `bg-gray-50 dark:bg-gray-900` from layout, rely on CSS variables

---

### Phase 5: Testing & Refinement (30 minutes)

#### 5.1 Test All Components
Verify all components look good in all three themes:
- [ ] Tables (extraction table, tanstack table)
- [ ] Modals (extraction modal, select documents)
- [ ] Forms (settings, ground truth editor)
- [ ] Cards and panels
- [ ] Sidebar navigation
- [ ] Buttons and inputs
- [ ] Charts and data visualizations

#### 5.2 Accessibility Testing
- [ ] Color contrast meets WCAG AA standards
- [ ] Keyboard navigation works
- [ ] Screen reader announces theme changes
- [ ] Focus indicators visible in all themes

#### 5.3 Performance Testing
- [ ] No flash of unstyled content (FOUC)
- [ ] Theme persists across page reloads
- [ ] Fast theme switching (<100ms)

---

## File Changes Required

### New Files
1. `src/providers/theme-provider.tsx` - Theme context provider
2. `src/components/theme-switcher.tsx` - Theme switcher UI component
3. `src/components/ui/theme-toggle.tsx` - Reusable theme toggle component

### Modified Files
1. `src/app/layout.tsx` - Add ThemeProvider
2. `src/app/globals.css` - Add purple theme variables + transitions
3. `src/components/header.tsx` - Add theme switcher
4. `src/components/sidebar.tsx` - Add theme switcher to sidebar
5. `package.json` - Add next-themes dependency

---

## Design Considerations

### Purple Mode Philosophy
Purple mode is designed as a **premium, creative-focused theme**:
- **Use Case**: Users who want a unique, less common theme
- **Mood**: Creative, sophisticated, modern
- **Differentiator**: Not just "dark mode with purple" - carefully balanced purple palette
- **Accessibility**: Maintains readability with proper contrast ratios

### Theme Naming Convention
- **Light** - "Light Mode" or "Day Mode"
- **Dark** - "Dark Mode" or "Night Mode"  
- **Purple** - "Purple Mode" or "Twilight Mode"

### Default Theme
- Use system preference detection
- If user has dark mode OS setting → start with dark
- Otherwise → start with light
- Purple requires explicit user selection

---

## Implementation Order

### Day 1: Core Infrastructure
1. ✅ Install next-themes
2. ✅ Create ThemeProvider
3. ✅ Integrate into layout
4. ✅ Test basic light/dark switching

### Day 2: Purple Theme
5. ✅ Design purple color palette
6. ✅ Add purple CSS variables
7. ✅ Test purple theme on key components
8. ✅ Adjust colors for accessibility

### Day 3: UI & Polish
9. ✅ Create theme switcher component
10. ✅ Add to header and sidebar
11. ✅ Add transition animations
12. ✅ Test across all pages

### Day 4: Final Testing
13. ✅ Comprehensive component testing
14. ✅ Accessibility audit
15. ✅ Performance optimization
16. ✅ Documentation

---

## Code Examples

### Theme Provider Example
```tsx
'use client'

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

### Theme Switcher Hook Usage
```tsx
import { useTheme } from 'next-themes'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  
  return (
    <DropdownMenu>
      <DropdownMenuItem onClick={() => setTheme('light')}>
        <Sun className="mr-2 h-4 w-4" />
        Light
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('dark')}>
        <Moon className="mr-2 h-4 w-4" />
        Dark
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('purple')}>
        <Sparkles className="mr-2 h-4 w-4" />
        Purple
      </DropdownMenuItem>
    </DropdownMenu>
  )
}
```

---

## Success Metrics

### User Experience
- ✅ Theme persists across sessions
- ✅ No flash of unstyled content on load
- ✅ Smooth transitions between themes
- ✅ Theme switcher accessible from any page
- ✅ All components readable in all themes

### Technical
- ✅ Zero console errors related to theming
- ✅ No hydration mismatches
- ✅ Theme switching < 100ms
- ✅ Bundle size increase < 10KB

### Accessibility
- ✅ All text meets WCAG AA contrast (4.5:1 for normal text)
- ✅ Theme switcher keyboard navigable
- ✅ Screen reader friendly
- ✅ Focus indicators visible

---

## Future Enhancements

### Phase 2 (Optional)
- [ ] Add more theme variants (Ocean Blue, Forest Green, etc.)
- [ ] Per-component theme overrides
- [ ] Theme customization panel (user picks own colors)
- [ ] Theme preview before switching
- [ ] Animated theme transition effects
- [ ] Time-based auto-switching (light during day, dark at night)

### Advanced Features
- [ ] Export/import custom themes
- [ ] Share themes via URL
- [ ] Theme marketplace
- [ ] High contrast mode for accessibility
- [ ] Colorblind-friendly themes

---

## Resources

### Color Tools
- [Realtime Colors](https://www.realtimecolors.com/) - Preview color palettes
- [Coolors](https://coolors.co/) - Color palette generator
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/) - WCAG compliance

### Inspiration
- [Radix Themes](https://www.radix-ui.com/themes/docs/theme/overview)
- [shadcn/ui themes](https://ui.shadcn.com/themes)
- [Next.js Examples](https://github.com/pacocoursey/next-themes)

### Documentation
- [next-themes GitHub](https://github.com/pacocoursey/next-themes)
- [Tailwind Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

---

## Risk Mitigation

### Potential Issues & Solutions

**Issue 1: Flash of Unstyled Content (FOUC)**
- **Solution**: Use `suppressHydrationWarning` on html tag (already in place)
- **Solution**: Set theme via script tag in head before render

**Issue 2: Component Style Inconsistencies**
- **Solution**: Comprehensive testing checklist
- **Solution**: Use CSS variables consistently, avoid hardcoded colors

**Issue 3: Purple Theme Too Bold**
- **Solution**: User testing and iteration
- **Solution**: Offer "soft purple" variant with less saturation

**Issue 4: Performance Impact**
- **Solution**: Lazy load theme switcher component
- **Solution**: Minimize CSS variable usage in hot paths

---

## Conclusion

This implementation will modernize the Box Accuracy App with flexible, beautiful theming that:
- ✨ **Enhances user experience** with personalization options
- 🎨 **Stands out** with unique purple mode
- ♿ **Maintains accessibility** with proper contrast
- ⚡ **Performs well** with optimized theme switching
- 🔮 **Sets foundation** for future theme expansions

**Estimated Total Time: 2.5 - 3 hours**

Ready to implement? Let's start with Phase 1! 🚀
