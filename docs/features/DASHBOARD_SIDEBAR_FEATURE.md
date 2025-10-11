# Dashboard Sidebar Feature

## Overview
Added a comprehensive dashboard sidebar to the home page that provides system status, quick navigation, and at-a-glance information about templates, authentication, and progress.

## Components

### `DashboardSidebar` Component
**Location:** `src/components/dashboard-sidebar.tsx`

A vertical sidebar displaying multiple informational cards with live data.

## Cards Implemented

### 1. **Authentication Status Card** ✅
- **Purpose:** Shows if user is authenticated with Box OAuth
- **States:**
  - ✅ **Connected** - Green badge, shows active connection
  - ❌ **Not Authenticated** - Red alert with link to Settings
- **Actions:** "Go to Settings →" link when not authenticated

### 2. **Metadata Templates Card** ✅
- **Purpose:** Lists configured extraction templates from Templates page
- **Features:**
  - Shows up to 5 templates with pagination indicator
  - Each template shows number of active fields
  - Click to navigate to Templates page
  - Hover effect with external link icon
- **Empty State:** Orange alert prompting user to add templates

### 3. **Prompt Library Card** ✅
- **Purpose:** Lists templates in the Prompt Library
- **Features:**
  - Shows template name, category, and field count
  - Direct links to Prompt Library
  - Up to 5 templates with "+X more" indicator
- **Empty State:** Centered message with link to library

### 4. **Ground Truth Progress Card** ✅
- **Purpose:** Shows ground truth data completion status
- **Features:**
  - Files with data count
  - Visual progress bar
  - Percentage complete
  - Link to Ground Truth page
- **Conditional:** Only shows when there's active accuracy data

### 5. **Recent Activity Card** ✅
- **Purpose:** Shows last comparison run information
- **Features:**
  - Activity type badge
  - Files processed count
  - Run date
- **Conditional:** Only shows when there's activity data

### 6. **Quick Actions Card** ✅
- **Purpose:** Fast access to common workflows
- **Features:**
  - Configure Templates button
  - Edit Ground Truth button
  - Manage Prompts button
  - Gradient background for visual distinction

### 7. **Getting Started Card** ✅
- **Purpose:** Link to documentation
- **Features:**
  - Opens [Box documentation](https://cloud.box.com/s/8yxlyqj2ud16k8q9ortql7fw4chsl06y) in new tab
  - Blue themed for help/documentation
  - External link icon for clarity

## Layout

### Desktop (> 1024px)
```
┌─────────────────────────────────┬──────────────┐
│  Control Bar                    │              │
├─────────────────────────────────┤              │
│                                 │  Dashboard   │
│                                 │  Sidebar     │
│     Main Content Area           │  (320px)     │
│     (flex-1)                    │              │
│                                 │  • Auth      │
│                                 │  • Templates │
│                                 │  • Library   │
│                                 │  • Progress  │
│                                 │  • Activity  │
│                                 │  • Actions   │
│                                 │  • Docs      │
└─────────────────────────────────┴──────────────┘
```

### Mobile/Tablet (< 1024px)
The sidebar maintains its width (320px) and scrolls vertically.
On very small screens, the flex layout will wrap.

## Data Sources

### Authentication Status
- **Source:** `localStorage.getItem('box_access_token')`
- **Logic:** Checks if token exists and has length

### Metadata Templates
- **Source:** `configuredTemplates` from `useAccuracyData()`
- **Type:** `BoxTemplate[]`
- **Properties:** `id`, `displayName`, `fields[]`

### Prompt Library Templates
- **Source:** `localStorage.getItem('prompt-library-database')`
- **Parsing:** JSON parsed on component mount
- **Type:** `{ id, name, category, fieldCount }[]`

### Ground Truth Stats
- **Source:** `getGroundTruthData()` + `accuracyData.results`
- **Calculation:**
  ```typescript
  filesWithGroundTruth / totalFiles * 100
  ```
- **Conditional:** Only shows when `accuracyData.results.length > 0`

### Last Activity
- **Source:** `accuracyData.results`
- **Properties:** `type`, `date`, `filesProcessed`
- **Conditional:** Only shows when accuracy data exists

## Styling

### Consistent Design
- Uses `@/components/ui/card` for all cards
- `border-2` for prominent borders
- Icons from `lucide-react`
- Badge components for status indicators
- Hover effects with transitions

### Color Coding
- **Green:** Success/Connected state
- **Red:** Error/Not authenticated
- **Orange:** Warning/Action needed
- **Blue:** Information/Documentation
- **Gradient:** Special cards (Quick Actions)

## Navigation

### Internal Links
- `/settings` - Authentication settings
- `/templates` - Metadata templates page
- `/library` - Prompt library
- `/ground-truth` - Ground truth editor

### External Links
- [Box Documentation](https://cloud.box.com/s/8yxlyqj2ud16k8q9ortql7fw4chsl06y) - Opens in new tab

## Props Interface

```typescript
interface DashboardSidebarProps {
  isAuthenticated: boolean;
  metadataTemplates: BoxTemplate[];
  promptLibraryTemplates: Array<{
    id: string;
    name: string;
    category: string;
    fieldCount: number;
  }>;
  groundTruthStats?: {
    totalFiles: number;
    filesWithGroundTruth: number;
    completionPercentage: number;
  };
  lastActivity?: {
    type: string;
    date: Date;
    filesProcessed: number;
  } | null;
  onNavigateToSettings?: () => void;
}
```

## Implementation Details

### Main Page Integration
**File:** `src/components/main-page-simplified.tsx`

1. **Import:** Added `DashboardSidebar` component
2. **Data Loading:** Loads prompt library from localStorage
3. **Calculations:** Computes stats in useMemo hooks
4. **Layout:** Flex layout with gap between main content and sidebar
5. **Responsive:** Uses `flex-1 min-w-0` for main content, fixed `w-80` for sidebar

## Future Enhancements

### Suggested Additions
1. **System Health Card** - API status, connection health
2. **Storage Quota Card** - Box storage usage
3. **Model Performance Card** - Best performing model summary
4. **Collapsible Cards** - Allow users to collapse/expand individual cards
5. **Customization** - Let users choose which cards to display
6. **Refresh Indicators** - Live update badges when data changes
7. **Notification Dots** - Indicate when action is needed

### Responsive Improvements
1. **Collapsible Sidebar** - Toggle button to hide/show sidebar
2. **Mobile Drawer** - Sidebar as drawer on mobile
3. **Card Reordering** - Drag-and-drop to reorder cards
4. **Compact Mode** - Smaller card size option

## Testing Checklist

- [ ] Authentication card shows correct status
- [ ] Templates list updates when templates are added/removed
- [ ] Prompt library data loads correctly
- [ ] Ground truth progress calculates correctly
- [ ] Links navigate to correct pages
- [ ] External documentation link opens in new tab
- [ ] Empty states display with proper alerts
- [ ] Hover effects work smoothly
- [ ] Layout responsive on different screen sizes
- [ ] No console errors on mount
- [ ] Cards scroll independently when overflow

## Performance Considerations

- Uses `useMemo` for expensive calculations
- Limits template lists to 5 items with pagination
- Lazy loads prompt library data on mount
- No unnecessary re-renders with proper memoization

## Accessibility

- Semantic HTML with proper heading hierarchy
- Clear link text and button labels
- External link indicators
- Screen reader friendly alt text
- Keyboard navigable
- Focus indicators on interactive elements

