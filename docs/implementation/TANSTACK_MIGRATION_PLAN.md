# TanStack Table Migration Plan

## Overview
Migrating from custom shadcn/ui Table to TanStack React Table for the main extraction table on the home page.

## Current Implementation Analysis

### Current Table Structure
- **Component**: `src/components/extraction-table.tsx` (557 lines)
- **Data Structure**: `AccuracyData` with fields, results, and averages
- **Complex 3-Level Headers**:
  1. **Field Names** - Spans across all model columns for each field
  2. **Prompts** - Shows prompt text, clickable to open prompt studio
  3. **Model Names** - Individual column headers for each AI model

### Key Features to Preserve
- ✅ 3-level grouped headers with proper column spanning
- ✅ Sticky first column (File Name) and header rows
- ✅ Interactive elements: prompt studio, inline editing, cell expansion
- ✅ Custom styling: alternating field colors, borders, hover effects
- ✅ Dynamic column visibility based on `shownColumns` prop
- ✅ Performance metrics display and comparison results
- ✅ Cell truncation with expand/collapse functionality
- ✅ Action buttons in headers (field run buttons)

## TanStack Table vs AG Grid Comparison

### TanStack Table Pros:
- ✅ Headless - complete control over styling and markup
- ✅ Smaller bundle size (~10-15kb)
- ✅ Great TypeScript support
- ✅ Flexible column definitions and header groups
- ✅ Works well with existing shadcn/ui components
- ✅ No licensing concerns (MIT license)
- ✅ Active development and community

### AG Grid Pros:
- ✅ More built-in features (virtualization, advanced filtering)
- ✅ Better performance for extremely large datasets (10k+ rows)
- ✅ Built-in cell renderers and editors
- ✅ Advanced features like tree data, master-detail

### Decision: TanStack Table
**Rationale**: Our dataset is relatively small (typically <100 files), we need complete styling control for the complex 3-level headers, and we want to maintain consistency with our existing shadcn/ui design system.

## Implementation Plan

### Phase 1: Setup and Basic Structure
1. ✅ Install `@tanstack/react-table`
2. ✅ Create new component `TanStackExtractionTable.tsx`
3. ✅ Define column structure for 3-level headers
4. ✅ Transform data format for TanStack consumption

### Phase 2: Header Groups Implementation
1. ✅ Create field-level column groups (Level 1)
2. ✅ Add prompt row as sub-headers (Level 2) 
3. ✅ Individual model columns (Level 3)
4. ✅ Implement proper column spanning logic

### Phase 3: Styling and Layout
1. 🔄 Recreate sticky positioning for headers and first column
2. ✅ Apply alternating field colors and borders
3. 🔄 Responsive design adjustments
4. ✅ Hover effects and visual states

### Phase 4: Interactive Features
1. ✅ Cell expansion/truncation functionality
2. ✅ Prompt studio integration
3. ✅ Inline editing capabilities  
4. ✅ Field run buttons in headers
5. ✅ Tooltip support

### Phase 5: Integration and Testing
1. ✅ Create feature flag for testing both tables side-by-side
2. 🔄 Test all interactive features
3. 🔄 Performance validation
4. 🔄 Mobile responsiveness testing

## Technical Implementation Details

### Column Definition Strategy
```typescript
// Pseudo-code structure
const columns = useMemo(() => {
  const dynamicColumns: ColumnDef<ProcessedRowData>[] = [];
  
  // File name column (always first, sticky)
  dynamicColumns.push({
    id: 'fileName',
    header: 'File Name',
    cell: ({ row }) => <FileNameCell {...row.original} />,
    meta: { sticky: 'left', rowSpan: 3 }
  });

  // For each field, create a column group
  data.fields.forEach((field, index) => {
    const fieldGroup: ColumnDef<ProcessedRowData> = {
      id: field.key,
      header: ({ table }) => <FieldHeaderGroup field={field} />,
      columns: visibleColumns.map(modelName => ({
        id: `${field.key}-${modelName}`,
        header: modelName,
        cell: ({ row, column }) => <ModelValueCell {...} />,
        meta: { fieldIndex: index, modelName }
      }))
    };
    dynamicColumns.push(fieldGroup);
  });

  return dynamicColumns;
}, [data.fields, visibleColumns]);
```

### Data Transformation
```typescript
// Transform AccuracyData.results into flat structure for TanStack
const processedData = useMemo(() => {
  return data.results.map(result => {
    const row: ProcessedRowData = {
      id: result.id,
      fileName: result.fileName,
      fileType: result.fileType,
      // Flatten field results into row structure
      ...data.fields.reduce((acc, field) => {
        visibleColumns.forEach(modelName => {
          acc[`${field.key}-${modelName}`] = {
            value: result.fields[field.key]?.[modelName] || '',
            groundTruth: result.fields[field.key]?.['Ground Truth'] || '',
            fieldKey: field.key,
            modelName
          };
        });
        return acc;
      }, {} as Record<string, CellData>)
    };
    return row;
  });
}, [data.results, data.fields, visibleColumns]);
```

## Migration Benefits

1. **Better Performance**: Built-in virtualization and optimized rendering
2. **Type Safety**: Strong TypeScript support with proper typing
3. **Maintainability**: Cleaner separation of data, presentation, and interaction logic  
4. **Extensibility**: Easy to add sorting, filtering, pagination if needed
5. **Testing**: Better testability with clear column definitions and data transformations
6. **Future-Proof**: Regular updates and strong community support

## Potential Challenges & Solutions

### Challenge 1: Complex 3-Level Headers
**Solution**: Use TanStack's `header` function with custom components and CSS grid for proper alignment.

### Challenge 2: Sticky Positioning
**Solution**: Leverage TanStack's built-in sticky column support with custom CSS for multi-level headers.

### Challenge 3: Interactive Elements in Headers
**Solution**: Custom header components that render buttons and handle events properly.

### Challenge 4: Cell Expansion State Management  
**Solution**: Use TanStack's row selection/expansion APIs or maintain separate state for expanded cells.

## Risk Mitigation

1. **Parallel Development**: Create new component alongside existing one
2. **Feature Parity Checklist**: Comprehensive testing of all existing features
3. **Rollback Plan**: Keep existing component available with feature flag
4. **Gradual Migration**: Can be rolled out to specific routes first

## Success Metrics

- [ ] All existing interactive features working
- [ ] 3-level header structure properly rendered
- [ ] Styling matches current implementation  
- [ ] Performance equal or better than current implementation
- [ ] Mobile responsiveness maintained
- [ ] No regressions in user experience

## Timeline Estimate

- **Phase 1**: 1-2 days
- **Phase 2**: 2-3 days  
- **Phase 3**: 1-2 days
- **Phase 4**: 2-3 days
- **Phase 5**: 1-2 days

**Total**: ~7-12 days depending on complexity of edge cases 