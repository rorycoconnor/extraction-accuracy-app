# Theme System UI Mockups

## Theme Switcher Design Options

### Option 1: Dropdown Menu in Header (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│  Box Accuracy App                     [🎨 Theme ▼] [@] [⚙] │
└─────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │ ☀️  Light Mode  │
                                    │ 🌙  Dark Mode   │
                                    │ ✨  Purple Mode ✓│
                                    └──────────────────┘
```

**Features:**
- Small, non-intrusive button
- Clear current selection indicator
- Icon + text for clarity
- Accessible via keyboard (Tab + Enter)

---

### Option 2: Icon-Only Button (Collapsed Sidebar)

```
┌────┐
│ ☀️ │  ← Light Mode
└────┘

┌────┐
│ 🌙 │  ← Dark Mode
└────┘

┌────┐
│ ✨ │  ← Purple Mode
└────┘
```

**Behavior:**
- Single button that cycles through themes
- Shows current theme icon
- Click to switch to next theme
- Tooltip shows theme name on hover

---

### Option 3: Segmented Control

```
┌──────────────────────────────────┐
│  ☀️ Light  │  🌙 Dark  │ ✨ Purple │
└──────────────────────────────────┘
      Active    Inactive    Inactive
```

**Features:**
- All options visible at once
- Clear active state
- Good for users who switch frequently
- Takes more horizontal space

---

## Theme Previews

### 🌞 Light Mode
```
╔══════════════════════════════════════════╗
║  Light Mode - Clean & Professional       ║
╠══════════════════════════════════════════╣
║                                          ║
║  Background: Light blue-gray (#F0F4F8)  ║
║  Cards: White (#FFFFFF)                 ║
║  Text: Dark gray (#1A202C)              ║
║  Primary: Blue (#3B82F6)                ║
║  Accents: Soft blue                     ║
║                                          ║
║  Best for: Daytime use, bright rooms    ║
╚══════════════════════════════════════════╝
```

---

### 🌙 Dark Mode
```
╔══════════════════════════════════════════╗
║  Dark Mode - Easy on Eyes                ║
╠══════════════════════════════════════════╣
║                                          ║
║  Background: Dark blue-gray (#0F172A)   ║
║  Cards: Slightly lighter (#1E293B)      ║
║  Text: Light gray (#F1F5F9)             ║
║  Primary: Bright blue (#3B82F6)         ║
║  Accents: Blue-gray                     ║
║                                          ║
║  Best for: Night time, low light        ║
╚══════════════════════════════════════════╝
```

---

### ✨ Purple Mode (NEW!)
```
╔══════════════════════════════════════════╗
║  Purple Mode - Creative & Unique         ║
╠══════════════════════════════════════════╣
║                                          ║
║  Background: Deep purple-gray (#1E1B2E) ║
║  Cards: Rich purple (#2D2640)           ║
║  Text: Light lavender (#E9E3FF)         ║
║  Primary: Vibrant purple (#8B5CF6)      ║
║  Accents: Light purple (#A78BFA)        ║
║                                          ║
║  Best for: Creative work, standing out  ║
╚══════════════════════════════════════════╝
```

---

## Placement Options

### In Header
```
┌─────────────────────────────────────────────────────────────┐
│ 📦 Box Accuracy App     [Templates] [Library] [Settings]    │
│                                         [🎨 Theme] [Profile] │
└─────────────────────────────────────────────────────────────┘
```
**Pros:** Always visible, easy to find
**Cons:** Takes header space

---

### In Sidebar
```
┌──────┬───────────────────────────────┐
│      │                               │
│ 🏠   │  Main Content Area           │
│ 📊   │                               │
│ 📚   │                               │
│ ⚙️   │                               │
│ ─────│                               │
│ 🎨   │  ← Theme Switcher            │
└──────┴───────────────────────────────┘
```
**Pros:** Out of the way, grouped with settings
**Cons:** Less discoverable

---

### In Settings Page
```
Settings
└── Appearance
    ├── Theme: [Light] [Dark] [Purple]
    ├── Font Size: Medium
    └── Animation: Enabled
```
**Pros:** Grouped with preferences
**Cons:** Requires navigation to settings

---

## Component States

### Hover State
```
┌──────────────────┐
│ ☀️  Light Mode  │  ← Default
└──────────────────┘

┌──────────────────┐
│ ☀️  Light Mode  │  ← Hover (subtle background)
└──────────────────┘
```

### Active/Selected State
```
┌──────────────────┐
│ ✨ Purple Mode ✓│  ← Selected (checkmark, accent color)
└──────────────────┘
```

### Focus State (Keyboard Navigation)
```
┌──────────────────┐
│║🌙 Dark Mode    ║│  ← Focus ring
└──────────────────┘
```

---

## Animation Concepts

### Theme Transition
```
Light → Dark → Purple
  ↑              ↓
  └──────────────┘

Animation: 200ms ease-in-out
- Background color fade
- Text color fade
- Border color fade
- No layout shift
```

### Theme Switcher Button
```
[🎨] → Hover → [🎨↗]
             Scale: 1.05
             Rotation: 5deg
```

---

## Mobile Responsive Design

### Mobile Header
```
┌─────────────────────────────┐
│ ☰  Box Accuracy      🎨  ⚙️ │
└─────────────────────────────┘
```
Icon-only button to save space

### Mobile Theme Picker (Full Screen Modal)
```
┌─────────────────────────────┐
│ Choose Theme            [×] │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐   │
│  │    ☀️ Light Mode    │   │
│  │  Currently Active   │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │    🌙 Dark Mode     │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │   ✨ Purple Mode    │   │
│  │      NEW!           │   │
│  └─────────────────────┘   │
│                             │
└─────────────────────────────┘
```

---

## Accessibility Considerations

### Keyboard Navigation
```
Tab → Focuses theme button
Enter/Space → Opens dropdown
↓/↑ → Navigate options
Enter → Select theme
Esc → Close dropdown
```

### Screen Reader
```
Button: "Theme switcher, current theme: Purple"
Menu Item: "Light mode, theme option"
Menu Item: "Dark mode, theme option"  
Menu Item: "Purple mode, theme option, selected"
```

### Focus Indicators
All interactive elements have visible focus rings that work in all themes

---

## Color Comparison Table

| Element           | Light Mode  | Dark Mode   | Purple Mode |
|-------------------|-------------|-------------|-------------|
| Background        | `#F0F4F8`   | `#0F172A`   | `#1E1B2E`   |
| Card              | `#FFFFFF`   | `#1E293B`   | `#2D2640`   |
| Text              | `#1A202C`   | `#F1F5F9`   | `#E9E3FF`   |
| Primary           | `#3B82F6`   | `#3B82F6`   | `#8B5CF6`   |
| Accent            | `#E0F2FE`   | `#334155`   | `#A78BFA`   |
| Border            | `#E2E8F0`   | `#334155`   | `#4C3F6B`   |

---

## User Flow

### First Time User
```
1. Opens app → System theme detected (light/dark)
2. Sees theme switcher in header
3. Hovers → Tooltip: "Change theme"
4. Clicks → Sees 3 options
5. Selects "Purple Mode"
6. Theme changes instantly
7. Preference saved to localStorage
```

### Returning User
```
1. Opens app → Purple theme loads immediately
2. No flash of wrong theme
3. Can change anytime via header button
```

---

## Implementation Notes

### CSS Variables Approach
```css
/* All themes use same variable names */
.light {
  --primary: 221 83% 53%;  /* Blue */
}

.dark {
  --primary: 221 83% 53%;  /* Same blue */
}

.purple {
  --primary: 265 75% 65%;  /* Purple! */
}

/* Components use variables */
.button-primary {
  background: hsl(var(--primary));
}
```

### No Hardcoded Colors
```tsx
// ❌ Bad
<div className="bg-blue-500">

// ✅ Good  
<div className="bg-primary">
```

---

## Success Criteria

- [ ] Theme switcher visible on all pages
- [ ] All 3 themes fully functional
- [ ] No FOUC (flash of unstyled content)
- [ ] Theme persists across refreshes
- [ ] Smooth transitions (200ms)
- [ ] Keyboard accessible
- [ ] Screen reader friendly
- [ ] Mobile responsive
- [ ] All components work in all themes
- [ ] WCAG AA contrast ratios met

---

## Preview Commands

After implementation, test with:

```bash
# Development mode
npm run dev

# Then manually test:
# 1. Switch between themes
# 2. Refresh page (persistence)
# 3. Open in incognito (system theme)
# 4. Test keyboard navigation
# 5. Test on mobile
```

---

## Related Files

- **Implementation Plan:** `THEME_SYSTEM_IMPLEMENTATION_PLAN.md`
- **Component:** `src/components/theme-switcher.tsx` (to be created)
- **Provider:** `src/providers/theme-provider.tsx` (to be created)
- **Styles:** `src/app/globals.css` (to be updated)
- **Layout:** `src/app/layout.tsx` (to be updated)
