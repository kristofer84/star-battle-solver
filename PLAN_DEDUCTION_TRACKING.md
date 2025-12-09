# Deduction Tracking System

## Overview
Create a main solver thread that collects deductions from all techniques and combines them to find hints that individual techniques might miss. Techniques return either a clear hint (100% certain) or deductions (partial information) for the main solver to analyze.

## Implementation Plan

### 1. Define Deduction Types

Create a flexible `Deduction` type system supporting multiple formats:
- Location: `src/types/deductions.ts` (new file)
- Structure using discriminated union:

```ts
// Base deduction properties
interface BaseDeduction {
  technique: TechniqueId;
  explanation?: string; // Optional explanation for debugging
}

// Cell-level: specific cell must be star/cross
interface CellDeduction extends BaseDeduction {
  kind: 'cell';
  cell: { row: number; col: number };
  type: 'forceStar' | 'forceEmpty';
}

// Block-level: 2x2 block must contain exactly N stars (or at most/at least)
interface BlockDeduction extends BaseDeduction {
  kind: 'block';
  block: { bRow: number; bCol: number }; // Block coordinates
  starsRequired?: number; // Exact number (if known)
  minStars?: number; // Minimum stars (default 0)
  maxStars?: number; // Maximum stars (default Infinity)
}

// Area-level: region/row/column constraints with bounds
interface AreaDeduction extends BaseDeduction {
  kind: 'area';
  areaType: 'row' | 'column' | 'region';
  areaId: number; // row index, column index, or region ID
  candidateCells: Array<{ row: number; col: number }>; // Cells where star could be
  starsRequired?: number; // Exact number (if known)
  minStars?: number; // Minimum stars (default 0)
  maxStars?: number; // Maximum stars (default Infinity)
}

// Exclusive set: exactly N of these cells must be stars
interface ExclusiveSetDeduction extends BaseDeduction {
  kind: 'exclusive-set';
  cells: Array<{ row: number; col: number }>;
  starsRequired: number; // Exact number of stars required
}

// Area relation: linked constraints across multiple areas
// Used for squeeze, set differentials, entanglement, fish patterns
interface AreaRelationDeduction extends BaseDeduction {
  kind: 'area-relation';
  areas: Array<{
    areaType: 'row' | 'column' | 'region';
    areaId: number;
    candidateCells: Array<{ row: number; col: number }>;
  }>;
  totalStars: number; // Sum of stars across all these areas
}

type Deduction = 
  | CellDeduction 
  | BlockDeduction 
  | AreaDeduction 
  | ExclusiveSetDeduction
  | AreaRelationDeduction;
```

**Key design notes:**
- Use `minStars`/`maxStars` for bounds-based reasoning (at least/at most)
- Use `starsRequired` only when exact count is known (100% certain)
- Main solver can upgrade bounds to exact counts when combined with global requirements
- AreaRelationDeduction makes cross-area constraints explicit

### 2. Modify Technique Interface

Update `Technique` interface in `src/logic/techniques.ts`:
- Create a new return type:
```ts
type TechniqueResult = 
  | { type: 'hint'; hint: Hint }
  | { type: 'deductions'; deductions: Deduction[] }
  | { type: 'none' };
```

- Update Technique interface to return `TechniqueResult` instead of `Hint | null`
- Keep backward compatibility: techniques can still return `Hint | null` and it will be wrapped

### 3. Create Deduction Utilities

New file: `src/logic/deductionUtils.ts`
Helper functions:
- `filterValidDeductions(deductions: Deduction[], state: PuzzleState): Deduction[]` - Filter out deductions for cells already filled
- `mergeDeductions(existing: Deduction[], newDeductions: Deduction[]): Deduction[]` - Merge and deduplicate deductions
- `normalizeDeductions(deductions: Deduction[]): Deduction[]` - Normalize and simplify deductions

### 4. Create Main Solver

New file: `src/logic/mainSolver.ts`
Function: `analyzeDeductions(deductions: Deduction[], state: PuzzleState): Hint | null`

The main solver analyzes collected deductions to:
- Detect conflicts (same cell forced to both star and empty) - indicates error
- Combine cell-level deductions into clear hints
- Resolve area/block deductions when constraints narrow down to specific cells
- Find cross-technique deductions (e.g., technique A says block must have star, technique B eliminates all but one cell)
- Only return hints that are 100% certain
- Returns `null` if no clear hint can be made

Key analysis strategies:
1. **Cell-level resolution**: If multiple deductions point to same cell → clear hint
2. **Area narrowing**: If area deduction has only one candidate cell left → cell-level deduction
3. **Block resolution**: If block deduction + cell eliminations leave only one possibility → cell-level deduction
4. **Exclusive set resolution**: If exclusive set has only one valid cell → cell-level deduction
5. **Bounds resolution**: Combine minStars/maxStars with global requirements to get exact counts
6. **Area relation resolution**: Use area relations + individual area constraints to narrow possibilities
7. **Cross-constraint**: Combine area/block/exclusive-set/relation deductions to narrow possibilities
8. **Upgrade bounds**: When minStars + maxStars + global requirement align → upgrade to exact count

### 5. Update findNextHint

Modify `src/logic/techniques.ts` `findNextHint` function:
- Maintain a deduction accumulator throughout the loop
- For each technique:
  - Call technique's findHint function
  - If technique returns a clear hint → return it immediately
  - If technique returns deductions → add to accumulator
  - After adding deductions, run main solver on accumulated deductions
  - If main solver finds a clear hint → return it immediately
  - Otherwise continue to next technique
- Return null if no hint found after all techniques

### 6. Update Techniques (Prioritized Implementation)

**Phase 1: Basic Rule Techniques** (Highest Priority)
These should always emit deductions, even when producing hints:
1. **Trivial Marks** (`trivialMarks.ts`)
   - Emit `CellDeduction` (forceEmpty) for cells adjacent to known stars
   - Emit `AreaDeduction` with maxStars=0 for filled rows/columns/regions
2. **Locked Line** (`lockedLine.ts`)
   - Emit `AreaDeduction` for rows/columns that are full
   - Emit `CellDeduction` (forceEmpty) for remaining cells
3. **Saturation** (`saturation.ts`)
   - Emit `AreaDeduction` with exact star counts
   - Emit `CellDeduction` (forceEmpty) for impossible cells
4. **Two-by-Two** (`twoByTwo.ts`)
   - Emit `BlockDeduction` with maxStars=1 for 2x2 blocks
   - Emit `BlockDeduction` with starsRequired=0 when block must be empty

**Phase 2: Counting-Based Techniques**
5. **Undercounting** (`undercounting.ts`)
   - Emit `ExclusiveSetDeduction` when R stars in R cells
   - Emit `AreaDeduction` with minStars when only "at least" is known
   - Emit `CellDeduction` (forceEmpty) for eliminated cells
6. **Overcounting** (`overcounting.ts`)
   - Similar to undercounting
7. **Finned Counts** (`finnedCounts.ts`)
   - Emit `ExclusiveSetDeduction` and area bounds
8. **Composite Shapes** (`compositeShapes.ts`)
   - Emit `ExclusiveSetDeduction` and area bounds

**Phase 3: Shape-Based Techniques**
9. **Simple Shapes** (`simpleShapes.ts`)
   - Emit `AreaDeduction` with candidateCells narrowed to shape
   - Emit `CellDeduction` (forceEmpty) for eliminated arms
10. **Cross-Empty Patterns** (`crossEmptyPatterns.ts`)
    - Emit `CellDeduction` (forceEmpty) for pattern eliminations
11. **Exclusion** (`exclusion.ts`)
    - Emit `CellDeduction` (forceEmpty) for excluded cells
    - Emit `AreaDeduction` with bounds for affected areas
12. **Pressured Exclusion** (`pressuredExclusion.ts`)
    - Similar to exclusion with area bounds

**Phase 4: Advanced Techniques**
13. **Schema-based** (`schemaBased.ts`)
    - Already has deduction structure, convert to new format
    - Return deductions when no clear hint
14. **N-Rooks** (`nRooks.ts`)
    - Emit `BlockDeduction` for 2x2 constraints
    - Emit `ExclusiveSetDeduction` for rook chains
    - Emit `AreaDeduction` with minStars for participating rows/columns
15. **Squeeze** (`squeeze.ts`)
    - Emit `AreaRelationDeduction` for linked areas
    - Emit `ExclusiveSetDeduction` when resolved
16. **Set Differentials** (`setDifferentials.ts`)
    - Emit `AreaRelationDeduction`
17. **Entanglement** (`entanglement.ts`)
    - Emit `ExclusiveSetDeduction` for chains
    - Emit `AreaRelationDeduction` for cross-area constraints

**For each technique:**
- Modify to return `TechniqueResult` instead of `Hint | null`
- When technique finds partial information but not a clear hint, return deductions
- **Also emit deductions even when producing hints** - this helps main solver combine information
- Keep existing behavior when clear hint is found
- Emit deductions for all logical eliminations, not just final hints

### 7. Testing

- Test that clear hints still work as before
- Test that deductions are collected correctly
- Test that main solver can combine different deduction types
- Test that main solver can resolve area/block deductions to cell-level hints
- Test that only 100% certain hints are returned
- Test cross-technique deduction resolution

## Files to Create/Modify

**Core Infrastructure:**
1. `src/types/deductions.ts` - New file with Deduction types (all formats)
2. `src/logic/deductionUtils.ts` - New file with deduction utilities
3. `src/logic/mainSolver.ts` - New file for analyzing deductions
4. `src/logic/techniques.ts` - Update Technique interface and findNextHint

**Technique Updates (Prioritized):**
5. `src/logic/techniques/trivialMarks.ts` - Phase 1
6. `src/logic/techniques/lockedLine.ts` - Phase 1
7. `src/logic/techniques/saturation.ts` - Phase 1
8. `src/logic/techniques/twoByTwo.ts` - Phase 1
9. `src/logic/techniques/undercounting.ts` - Phase 2
10. `src/logic/techniques/overcounting.ts` - Phase 2
11. `src/logic/techniques/finnedCounts.ts` - Phase 2
12. `src/logic/techniques/compositeShapes.ts` - Phase 2
13. `src/logic/techniques/simpleShapes.ts` - Phase 3
14. `src/logic/techniques/exclusion.ts` - Phase 3
15. `src/logic/techniques/schemaBased.ts` - Phase 4
16. `src/logic/techniques/nRooks.ts` - Phase 4
17. `src/logic/techniques/squeeze.ts` - Phase 4
18. `src/logic/techniques/entanglement.ts` - Phase 4

## Key Design Decisions

- Techniques return hints immediately if they're 100% certain
- **Techniques should emit deductions even when producing hints** - helps main solver combine information
- Deductions are collected incrementally as techniques run
- Main solver evaluates deductions after each technique adds to the accumulator
- Main solver only returns hints that are 100% certain
- Deductions include which technique made them for debugging/tracing
- Support multiple deduction formats (cell, block, area with bounds, exclusive-set, area-relation)
- Use bounds (minStars/maxStars) for "at least/at most" constraints to stay 100% sound
- Use exact counts (starsRequired) only when 100% certain
- Main solver upgrades bounds to exact counts when combined with global requirements
- Backward compatible: techniques that don't return deductions still work
- **Any technique that prunes candidates should emit CellDeduction instances**

