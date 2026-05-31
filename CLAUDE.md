# Star Battle Solver — Developer Guide

## Project overview

Front-end only Star Battle hint engine built with **Vite + Vue 3 + TypeScript**.
Target puzzle: 10×10 board, 2 stars per row/column/region.
Goal: step-by-step logical hints, no guessing. See `TECHNIQUES.md` for the full technique list and `ENTANGLEMENT.md` for the entanglement pattern file format.

## Quick start

```bash
npm install
npm run dev      # Vite dev server
npm run build    # Production build (GitHub Pages)
npm test         # Vitest unit tests
```

## Source layout

```
src/
  App.vue                       # Root component, puzzle editor + play mode
  components/                   # Vue UI components
  logic/
    mainSolver.ts               # findNextHint() — iterates techniquesInOrder
    helpers.ts                  # Board helpers: getCell, neighbors8, rowCells, …
    constraints/                # Row/column/region quota helpers
    entanglements/              # Entanglement pattern engine
      loader.ts                 # Parses JSON spec files, generates pattern IDs
      matcher.ts                # applyTripleRule / applyConstrainedRule / applyPairPattern
      features.ts               # Boolean feature evaluators for constrained rules
      transformations.ts        # D4 symmetry group (8 rotations/reflections)
      debug.ts                  # Debug logging helpers
    patterns/                   # Schema-based pattern logic (separate from entanglements)
    schemas/                    # Schema logic engine
    techniques/                 # One file per solving technique
      trivialMarks.ts
      entanglementPatterns.ts   # Wrapper that calls the entanglement engine
      … (30+ other technique files)
  specs/
    entanglements/              # JSON pattern data files
      index.ts                  # Explicit imports so Vite bundles them
      example-pair.json
      example-triple.json
      10x10-2star-entanglements.json                        # pair patterns (absolute coords)
      10x10-2star-entanglements-constrained-entanglements.json  # canonical + feature rules
      10x10-2star-entanglements-triple-entanglements.json   # canonical triple rules
      backup/                   # Removed/archived files — NOT imported by index.ts
    patterns/                   # Schema-based pattern specs
  store/                        # Pinia stores
  types/                        # Shared TypeScript interfaces
tests/                          # Vitest tests (co-located with src or here)
```

## Running tests

```bash
node_modules/.bin/vitest run           # full suite
node_modules/.bin/vitest run <file>    # single file
```

Known pre-existing failures (not caused by recent changes):
- `integration-verification.test.ts` — technique list hardcoded in test, not updated
- `techniqueOrdering.test.ts` — expected count out of date
- `propertyTests.test.ts` Property 10/11 — 1×4 strip technique edge case

## Architecture: solver loop

`mainSolver.ts › findNextHint()` iterates `techniquesInOrder` in priority order.
Each technique returns one of:
- `{ type: 'hint', hint }` — immediate forced move (star or cross)
- `{ type: 'deductions', deductions }` — partial facts added to the deduction pool
- `{ type: 'none' }` — nothing found

After each technique the deduction pool is analysed; if it resolves a cell that technique is credited as the winner. See `TECHNIQUES.md` for ordering principles.

## Entanglement pattern engine

Pre-computed JSON files describe geometric relationships between placed stars and forced-empty cells. Three matchers in `matcher.ts`:

### `applyTripleRule` (triple/constrained entanglement file, Type B)
- Uses **canonical coordinates** (may be negative or > board size)
- Tries all 8 **D4 transformations** (rotations + reflections) × all star combinations
- Finds translation offset to map canonical stars onto actual board stars
- Transforms the single `canonical_candidate` to a board cell
- Skips candidate if adjacent to any matched star (adjacency rule already handles it)
- Evaluates `constraint_features` (candidate-level: `candidate_on_outer_ring`, etc.)

### `applyConstrainedRule` (constrained entanglement file, Type C/D)
- Same D4 + translation matching as above
- `canonical_forced_empty` is a **list** of cells forced empty (not a single candidate)
- Features are evaluated **once per mapping** (not per cell) — they describe board/star state
  - Star-position: `allStarsInLeftHalf`, `anyStarOnRightEdge`, …
  - Board-state: `has_empty_on_row0`, `has_empty_in_bottom_right_3x3`, …
- Each in-bounds, undecided, non-adjacent cell in `canonical_forced_empty` is returned

### `applyPairPattern` (pair entanglement file, Type A)
- Uses **absolute board coordinates** — no D4 transformation
- All 8 symmetric variants of a pair are stored as separate entries in the JSON
- Fires when `initial_stars ⊆ actualStars` (subset check, not exact match)
- Returns `forced_empty` cells that are still undecided and not adjacent to the pattern stars

### Symmetry in pattern files

| File | Coordinates | D4 coverage |
|---|---|---|
| `10x10-2star-entanglements.json` (pair) | Absolute | Each D4 variant is a separate entry |
| `10x10-2star-entanglements-triple-entanglements.json` | Canonical | One pattern covers all 8 variants |
| `10x10-2star-entanglements-constrained-entanglements.json` | Canonical | One pattern covers all 8 variants |

### Pattern IDs

Deterministic 6-character hex hashes (`hashString` in `loader.ts`) generated from sorted
canonical stars + candidate/forced-empty + features. Used in hint explanations and tests.
Example: pattern `21f369` = stars `[[0,0],[0,2]]`, candidate `[-1,-1]` (now archived as
invalid — adjacent to `[0,0]`).

### Archived patterns (`src/specs/entanglements/backup/`)

- `*-adjacent-invalid.json`: 762 triple rules whose candidate was adjacent to a star —
  `applyTripleRule` already skips these via adjacency check; they never produce a hint.
- `*-pure-entanglements.json`: pure templates identical to the constrained file's
  `unconstrained_rules` — duplicate data, not loaded.
- See `backup/README.md` for restoration instructions.

## Key conventions

- **0-based coordinates**: `[row, col]`, row 0 = top, col 0 = left.
- **Cell states**: `'empty'` (undecided), `'star'`, `'cross'`.
- **`neighbors8`**: all 8 diagonally/orthogonally adjacent cells.
- Techniques never modify state; they return hints the UI applies.
- Pattern matchers skip cells already marked non-`'empty'` and cells adjacent to matched
  stars (the basic adjacency rule handles those).

## Adding a new feature to the constrained rule evaluator

1. Add the case to `evaluateFeature` in `src/logic/entanglements/features.ts`.
2. Features with `null` candidate are mapping-level (board state or star positions).
3. Features with a `Coords` candidate are candidate-level.
4. Add a test in `tests/patternMatchingConstraint.test.ts`.
