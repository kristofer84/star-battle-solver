# AGENTS.md - Instructions for AI Coding Assistants

This file provides structured instructions for AI coding assistants (like Codex, GitHub Copilot, Cursor) working with the Star Battle Solver codebase.

## Project Overview

**Star Battle Solver** is a front-end only web application built with **Vite + Vue 3 + TypeScript**. It provides purely logical, step-by-step hints for solving 10×10 Star Battle puzzles with 2 stars per row/column/region.

### Key Characteristics

- **Pure logic solver**: No guessing, only sound logical deductions
- **Technique-based**: Implements 31+ solving techniques from "A Star Battle Guide" by Kris De Asis
- **Schema-based engine**: 18 logical schemas for structured deductions
- **Pattern matching**: Pre-generated pattern library for common configurations
- **Entanglement patterns**: Star-based pattern recognition with D4 symmetry
- **Vue 3 Composition API**: Modern reactive state management
- **TypeScript**: Fully typed codebase with strict mode

### Architecture

The solver uses a hierarchical technique system:
1. **Technique Registry** (`src/logic/techniques.ts`): Orchestrates all solving techniques in priority order
2. **Individual Techniques** (`src/logic/techniques/`): 31+ pure functions that analyze puzzle state
3. **Schema System** (`src/logic/schemas/`): 18 structured logical schemas
4. **Pattern Matching** (`src/logic/patterns/`): Pre-generated pattern matchers
5. **Entanglement Matching** (`src/logic/entanglements/`): Star-based pattern recognition
6. **State Management** (`src/store/puzzleStore.ts`): Vue reactive store for puzzle state

---

## Build and Test Commands

### Setup

```bash
cd star-battle-solver
npm install
```

### Development

```bash
npm run dev          # Start Vite dev server (typically http://localhost:5173)
```

### Building

```bash
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
```

### Testing

```bash
npm test             # Run all Vitest tests
npm test -- <file>   # Run specific test file
npm run test:json    # Run tests with JSON output
```

**Test Framework**: Vitest  
**Test Location**: `tests/` directory (mirrors `src/` structure)

---

## Code Style and Conventions

### TypeScript Configuration

- **Strict mode**: Enabled (`strict: true` in `tsconfig.json`)
- **Target**: ESNext
- **Module**: ESNext with bundler resolution
- **No implicit any**: All types must be explicit

### File Naming

- **Components**: PascalCase (e.g., `StarBattleBoard.vue`)
- **Utilities/Logic**: camelCase (e.g., `findTrivialMarksHint.ts`)
- **Types**: camelCase (e.g., `puzzle.ts`, `hints.ts`)
- **Tests**: Same name as source + `.test.ts` (e.g., `trivialMarks.test.ts`)

### Code Style

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings (TypeScript/JavaScript)
- **Semicolons**: Yes
- **Trailing commas**: Yes in multi-line arrays/objects
- **Function declarations**: Prefer `function` keyword for exported functions
- **Arrow functions**: Use for callbacks and inline functions

### Vue Component Style

- **Composition API**: Use `<script setup>` syntax
- **Reactive imports**: `import { ref, computed, watch } from 'vue'`
- **Store imports**: `import { store } from '../store/puzzleStore'`
- **Type imports**: Use `import type` for type-only imports

### Example Code Pattern

```typescript
import type { PuzzleState } from '../types/puzzle';
import type { Hint } from '../types/hints';
import { rowCells, colCells, neighbors8 } from '../helpers';

export function findExampleHint(state: PuzzleState): Hint | null {
  // Analysis logic here
  const forcedStars: Array<{ row: number; col: number }> = [];
  
  if (forcedStars.length === 0) {
    return null;
  }
  
  return {
    id: `hint-${Date.now()}`,
    kind: 'place-star',
    technique: 'example',
    resultCells: forcedStars,
    explanation: 'Clear explanation',
  };
}
```

---

## File Structure

```
star-battle-solver/
├── src/
│   ├── App.vue                    # Main Vue component
│   ├── main.ts                    # Application entry point
│   ├── style.css                  # Global styles
│   │
│   ├── components/                # Vue components
│   │   ├── StarBattleBoard.vue   # Main puzzle board
│   │   ├── HintPanel.vue         # Hint display
│   │   ├── ModeToolbar.vue       # Mode switching
│   │   └── ...
│   │
│   ├── logic/                     # Core solving logic
│   │   ├── techniques.ts         # Technique registry (START HERE)
│   │   ├── techniques/           # Individual techniques (31 files)
│   │   │   ├── trivialMarks.ts
│   │   │   ├── schemaBased.ts    # Delegates to schema system
│   │   │   └── ...
│   │   │
│   │   ├── schemas/              # Schema-based logical engine
│   │   │   ├── registry.ts       # Schema registration
│   │   │   ├── runtime.ts        # Runtime integration
│   │   │   ├── schemas/          # Individual schemas (18 files)
│   │   │   │   ├── E1_candidateDeficit.ts
│   │   │   │   ├── A1_rowBandRegionBudget.ts
│   │   │   │   └── ...
│   │   │   ├── helpers/          # Schema helper functions
│   │   │   └── explanations/    # Explanation templates
│   │   │
│   │   ├── patterns/            # Pattern matching
│   │   ├── entanglements/       # Entanglement pattern matching
│   │   ├── helpers.ts           # Shared utility functions
│   │   ├── validation.ts        # State validation
│   │   └── search.ts            # Backtracking solver (for tests)
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── puzzle.ts            # PuzzleState, PuzzleDef types
│   │   ├── hints.ts             # Hint, TechniqueId types
│   │   └── entanglements.ts     # Entanglement pattern types
│   │
│   ├── store/                    # Vue state management
│   │   └── puzzleStore.ts       # Main reactive store
│   │
│   └── specs/                    # Data files
│       ├── patterns/             # Pre-generated pattern JSON files
│       └── entanglements/        # Entanglement pattern JSON files
│
├── tests/                        # Test files (mirrors src/ structure)
│   └── ...                      # 85+ test files
│
├── specs/                        # Project documentation
│   ├── design.md                # Design document
│   ├── requirements.md          # Requirements specification
│   └── ...
│
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts               # Vite configuration
└── vitest.config.ts             # Vitest configuration
```

---

## Key Entry Points

### Understanding the Solver Flow

1. **User requests hint** → `App.vue` calls `findNextHint()`
2. **Technique registry** → `src/logic/techniques.ts` → `findNextHint()`
3. **Techniques execute** → Each technique in `src/logic/techniques/` analyzes state
4. **First match wins** → Returns `Hint` or `null`
5. **Hint displayed** → `HintPanel.vue` shows explanation and highlights

### Main Files to Understand

- **`src/logic/techniques.ts`**: Start here - orchestrates all techniques
- **`src/types/puzzle.ts`**: Core data structures (`PuzzleState`, `PuzzleDef`)
- **`src/types/hints.ts`**: Hint structure and technique IDs
- **`src/logic/helpers.ts`**: Utility functions (rowCells, colCells, neighbors8, etc.)
- **`src/store/puzzleStore.ts`**: Reactive state management

### Adding a New Technique

1. Create file: `src/logic/techniques/yourTechnique.ts`
2. Export function: `export function findYourTechniqueHint(state: PuzzleState): Hint | null`
3. Register in: `src/logic/techniques.ts` (add to `techniquesInOrder` array)
4. Add ID to: `src/types/hints.ts` (add to `TechniqueId` type)
5. Write tests: `tests/yourTechnique.test.ts`

### Adding a New Schema

1. Create file: `src/logic/schemas/schemas/YourSchema.ts`
2. Implement schema with `registerSchema()` call
3. Add explanation template: `src/logic/schemas/explanations/templates.ts`
4. Write tests: `src/logic/schemas/__tests__/YourSchema.test.ts`

---

## Testing Guidelines

### Test Structure

- **Location**: `tests/` directory mirrors `src/` structure
- **Naming**: `*.test.ts` suffix
- **Framework**: Vitest with jsdom for DOM testing

### Test Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { findYourTechniqueHint } from '../src/logic/techniques/yourTechnique';
import { createEmptyPuzzleState } from '../src/types/puzzle';

describe('YourTechnique', () => {
  it('should find hint when applicable', () => {
    const state = createEmptyPuzzleState(puzzleDef);
    // Setup state...
    const hint = findYourTechniqueHint(state);
    expect(hint).not.toBeNull();
    expect(hint?.technique).toBe('your-technique-id');
  });
  
  it('should return null when not applicable', () => {
    const state = createEmptyPuzzleState(puzzleDef);
    const hint = findYourTechniqueHint(state);
    expect(hint).toBeNull();
  });
});
```

### Validation Requirements

- **Always validate hints**: Use `validateState()` from `src/logic/validation.ts`
- **Test edge cases**: Empty boards, full boards, boundary conditions
- **Verify soundness**: Hints must be logically correct, not just syntactically valid

### Running Specific Tests

```bash
npm test -- trivialMarks        # Run tests matching "trivialMarks"
npm test -- C2_specificCase     # Run specific test file
```

---

## Common Tasks

### Finding Where Code Lives

- **Technique implementations**: `src/logic/techniques/`
- **Schema implementations**: `src/logic/schemas/schemas/`
- **Type definitions**: `src/types/`
- **Helper functions**: `src/logic/helpers.ts`
- **State management**: `src/store/puzzleStore.ts`
- **UI components**: `src/components/`

### Understanding Puzzle State

```typescript
interface PuzzleState {
  def: PuzzleDef;              // Puzzle definition (size, regions, etc.)
  cells: CellState[][];         // 2D array: 'star' | 'cross' | 'empty'
}

interface PuzzleDef {
  size: number;                // Board size (typically 10)
  starsPerUnit: number;        // Stars per row/column/region (typically 2)
  regions: number[][];          // Region IDs for each cell
}
```

### Accessing Puzzle Data

```typescript
import { rowCells, colCells, regionCells, neighbors8 } from '../helpers';

// Get all cells in a row
const row = rowCells(state, rowIndex);

// Get all cells in a column
const col = colCells(state, colIndex);

// Get all cells in a region
const region = regionCells(state, regionId);

// Get 8-directional neighbors
const neighbors = neighbors8({ row, col }, state.def.size);
```

### Creating Hints

```typescript
const hint: Hint = {
  id: `hint-${Date.now()}`,
  kind: 'place-star',  // or 'place-cross'
  technique: 'your-technique-id',
  resultCells: [{ row: 0, col: 0 }],
  explanation: 'Clear explanation of the deduction',
  highlights: {
    cells: [{ row: 0, col: 0 }],
    rows: [0],      // Optional
    cols: [1],      // Optional
    regions: [5],    // Optional
  },
};
```

---

## Important Patterns

### Pure Functions

All techniques are **pure functions**:
- ✅ Take `PuzzleState` as input
- ✅ Return `Hint | null`
- ✅ No side effects
- ✅ Don't modify input state

### Early Return Pattern

```typescript
export function findHint(state: PuzzleState): Hint | null {
  // Early validation
  if (someCondition) {
    return null;
  }
  
  // Analysis
  const forcedStars = [];
  // ... logic ...
  
  // Early return if nothing found
  if (forcedStars.length === 0) {
    return null;
  }
  
  // Return hint
  return { /* ... */ };
}
```

### Validation Pattern

```typescript
import { validateState } from '../logic/validation';

// Always validate before returning hints
const candidateState = { ...state, cells: modifiedCells };
const issues = validateState(candidateState);
if (issues.length > 0) {
  return null; // Invalid state
}
```

---

## Dependencies

### Runtime Dependencies

- **vue**: ^3.5.0 (Vue 3 Composition API)

### Development Dependencies

- **@vitejs/plugin-vue**: Vue plugin for Vite
- **typescript**: TypeScript compiler
- **vite**: Build tool and dev server
- **vitest**: Test framework
- **fast-check**: Property-based testing
- **jsdom**: DOM environment for tests

### No External Runtime Dependencies

The solver is intentionally dependency-free at runtime (except Vue). All logic is self-contained.

---

## Code Quality Standards

### Type Safety

- ✅ **Strict TypeScript**: All code must be fully typed
- ✅ **No `any` types**: Use proper types or `unknown`
- ✅ **Type imports**: Use `import type` for type-only imports

### Error Handling

- ✅ **Return null gracefully**: Techniques return `null` when no hint found
- ✅ **Validate inputs**: Check state validity before processing
- ✅ **No exceptions**: Techniques should not throw (return null instead)

### Performance

- ✅ **Early termination**: Return as soon as hint found
- ✅ **Efficient algorithms**: Avoid O(n³) operations when possible
- ✅ **Performance monitoring**: Check console for warnings (>100ms)

### Documentation

- ✅ **Function comments**: Document complex logic
- ✅ **Type documentation**: Use JSDoc for exported functions
- ✅ **Clear explanations**: Hints must have readable explanations

---

## Debugging

### Performance Monitoring

The solver logs performance metrics:
- **Warning**: Techniques taking >100ms
- **Freeze detection**: Techniques taking >5000ms
- Check browser console for timing information

### Common Issues

1. **Technique returns null unexpectedly**
   - Check state conversion (PuzzleState → BoardState for schemas)
   - Verify helper functions work correctly
   - Check for off-by-one errors

2. **Invalid hints**
   - Always use `validateState()` before returning
   - Check quota constraints (row/column/region star counts)
   - Verify adjacency constraints

3. **Type errors**
   - Ensure all types are imported correctly
   - Check `TechniqueId` includes new technique IDs
   - Verify `PuzzleState` structure matches

### Debug Logging

```typescript
console.log('[DEBUG] YourTechnique:', {
  state: state.cells,
  foundStars: forcedStars,
});
```

---

## Security Considerations

- **No user input validation needed**: Puzzle state is internal
- **No external API calls**: All logic is client-side
- **No sensitive data**: Puzzle definitions are public
- **XSS protection**: Vue automatically escapes template content

---

## Additional Resources

- **Design Document**: `specs/design.md` - Architecture and design decisions
- **Requirements**: `specs/requirements.md` - Detailed requirements
- **Schema Documentation**: `src/logic/schemas/README.md` - Schema system docs
- **Entanglement Docs**: `ENTANGLEMENT.md` - Entanglement pattern format

---

## Quick Reference

### Most Common Files to Edit

1. `src/logic/techniques.ts` - Add new techniques to registry
2. `src/logic/techniques/*.ts` - Implement new techniques
3. `src/types/hints.ts` - Add new technique IDs
4. `tests/*.test.ts` - Write tests

### Most Important Types

- `PuzzleState` - Current puzzle state
- `Hint` - Hint returned by techniques
- `TechniqueId` - Technique identifier type
- `CellState` - 'star' | 'cross' | 'empty'

### Most Used Helpers

- `rowCells(state, row)` - Get row cells
- `colCells(state, col)` - Get column cells
- `regionCells(state, regionId)` - Get region cells
- `neighbors8(coords, size)` - Get 8-directional neighbors
- `validateState(state)` - Validate puzzle state

---

This file should help AI coding assistants understand the codebase structure, conventions, and common patterns. When making changes, follow these guidelines and maintain consistency with existing code.
