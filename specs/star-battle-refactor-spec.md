# Star Battle Solver Refactor and C2 Band Logic Specification

This document gives firm, step‑by‑step instructions for restructuring the schema‑based solver logic and implementing the band‑based C2 cage logic so that the `tests/C2_specificCase.test.ts` scenario is solved correctly.

The instructions are written for the existing repository layout:

- Root: project root containing `src`, `tests`, `package.json`.
- Logic: `src/logic`.
- Types: `src/types`.
- Schema system: `src/logic/schemas/**`.
- Techniques and main solver: `src/logic/techniques.ts` and `src/logic/mainSolver.ts`.

All file paths below are relative to the project root.

---

## 0. Target behaviour for the C2_specificCase scenario

The test case in `tests/C2_specificCase.test.ts` documents the following situation for a 10×10, 2‑star puzzle:

1. **Area C corresponds to puzzle region 3** (0‑based in the puzzle string). In the schema engine this region has `id === 4` (1‑based region id).
2. In the **first three rows** (rows 0–2, 0‑based), the existing stars and crosses imply that there must be **exactly one star in area C in those three rows**.
3. Considering **rows 3–4** as a row band, and counting all valid 2×2 blocks (cages) for the remaining stars in that band, there is **exactly one 2×2 block that is fully contained in area C** and can host that required star.
4. Therefore, in rows 3–4, **all other currently empty cells in area C must be crosses**.

After implementing all tasks in this specification, the following must hold for that test:

- `getRegionBandQuota` correctly deduces that region 4 (puzzle region 3) must place **1 star in the row band 0–2**, and that this forces exactly **1 star in rows 3–4** for the same region.
- The C2 schema `C2_cagesRegionQuota` finds that **only one 2×2 cage in rows 3–4 is fully inside that region and consistent with the quotas**, which forces all other unknown cells of this region in that band to be crosses.
- `findSchemaBasedHint` returns a schema‑based hint that contains at least one `forceEmpty` (cross) in area C for rows 3–4, and no incorrect cells.
- The rewritten `tests/C2_specificCase.test.ts` asserts these facts directly and passes with no debug output and no placeholder expectations.

---

## 1. Keep the existing solver architecture, but tighten roles

The project already has:

- `src/logic/mainSolver.ts` – collects `Deduction[]` and converts them into a `Hint`.
- `src/logic/techniques.ts` – orchestrates all techniques.
- `src/logic/techniques/schemaBased.ts` – bridges schema engine and technique system.
- `src/logic/schemas/**` – schema engine, helpers and schemas.

This specification keeps this architecture and tightens the responsibilities as follows:

1. The **schema engine** (`src/logic/schemas/**`) must only produce *primitive logical facts* about the board:
   - `forceStar` or `forceEmpty` on specific cells.
   - Quotas for regions in bands (exact number of stars in a specific row or column band).
   - Block‑level information such as “star must be in this 2×2 cage”.
2. The **schema‑based technique** (`src/logic/techniques/schemaBased.ts`) must:
   - Convert schema applications into `Deduction` objects.
   - Optionally wrap them into a single `Hint` via `findSchemaBasedHint` after validation.
   - Never invent deductions that are not backed by schemas.
3. The **main solver** (`src/logic/mainSolver.ts`) remains the central component that:
   - Validates deductions.
   - Merges compatible deductions from all techniques.
   - Chooses a final `Hint` for the UI.

The refactor for C2 therefore focuses on:

- Correct C1 and region‑band quota logic in the schema helper layer.
- Correct C2 cage logic in `C2_cagesRegionQuota.ts`.
- Clean, deterministic conversions into deductions by `schemaBased.ts`.

---

## 2. Band and block helpers: tighten semantics

The schema C2 logic relies on helpers in:

- `src/logic/schemas/helpers/bandHelpers.ts`
- `src/logic/schemas/helpers/blockHelpers.ts`

This section defines the required semantics for the helpers used by C2.

### 2.1 `computeRemainingStarsInBand`

**File:** `src/logic/schemas/helpers/bandHelpers.ts`  
**Function:**

```ts
export function computeRemainingStarsInBand(
  band: RowBand | ColumnBand,
  state: BoardState
): number
```

This function is already present. Ensure it behaves exactly as follows:

- For a `RowBand`:
  - Let `rows = band.rows`.
  - The total capacity in this band is `rows.length * state.starsPerLine`.
- For a `ColumnBand`:
  - Let `cols = band.cols`.
  - The total capacity in this band is `cols.length * state.starsPerLine`.
- In both cases, `currentStars` is the number of cells in `band.cells` whose `cellStates` is `CellState.Star`.
- The function must return `Math.max(0, totalCapacity - currentStars)`.

Do not include any other conditions or approximations in this function.

### 2.2 `getValidBlocksInBand`

**File:** `src/logic/schemas/helpers/blockHelpers.ts`  
**Function:**

```ts
export function getValidBlocksInBand(
  band: RowBand | ColumnBand,
  state: BoardState
): Block2x2[]
```

Ensure the following behaviour:

1. Let `bandCells = new Set(band.cells)`.
2. A block `block: Block2x2` is **considered** only if **all four cells** of the block belong to `bandCells`. If any cell is outside the band, skip the block.
3. If **any** of the four cells of the block has `cellStates[cellId] === CellState.Star`, the block is **not valid** and must be skipped. A block that already contains a star is considered “used” and cannot be used by C2 to host a new star.
4. Each block maintains an array of candidate cells (this already exists on `Block2x2`):
   - A candidate cell is a cell inside the block whose `cellStates[cellId] === CellState.Unknown` and for which `isStarCandidate(state, cellId)` returns `true`.
   - If a block has **zero** candidate cells, skip it (it cannot host any new star).
5. The function must return an array of blocks satisfying all the above.

After this change, for the C2 test’s **row band 3–4**, `getValidBlocksInBand` must return only blocks that can still host a star, given row, column, region and adjacency constraints.

### 2.3 `findMaxNonOverlappingBlocks` and `getMaxNonOverlappingBlocksInBand`

**File:** `src/logic/schemas/helpers/blockHelpers.ts`  
**Functions:**

```ts
export function getMaxNonOverlappingBlocksInBand(
  band: RowBand | ColumnBand,
  state: BoardState
): Block2x2[]
```

and the internal helper

```ts
function findMaxNonOverlappingBlocks(blocks: Block2x2[]): Block2x2[]
```

Update these functions so that **C1 is meaningful** for the C2 scenario.

Required behaviour:

1. `getMaxNonOverlappingBlocksInBand` must:
   - Call `getValidBlocksInBand(band, state)` to get all valid blocks in that band.
   - Call `findMaxNonOverlappingBlocks` on that array.
   - Return the resulting set of blocks.

2. `findMaxNonOverlappingBlocks` must return a set of blocks `S` such that:
   - The blocks in `S` are pairwise non‑overlapping (no shared `cellId`).
   - There exists **at least one** assignment of placements of a single new star inside each block in `S` that does **not** violate:
     - The `starsPerLine` quota for each row and column.
     - The `starsPerRegion` quota for each region.
     - Star adjacency (no two stars are orthogonally or diagonally adjacent).
   - Among all such sets, `S` has **maximum possible size**.

3. Implement `findMaxNonOverlappingBlocks` as follows:

   - If `blocks.length <= 15`, perform an exact search:
     1. Enumerate all subsets of `blocks`.
     2. Discard any subset where any two blocks overlap.
     3. For each remaining subset `S`, perform a backtracking search that assigns a candidate cell to each block in `S` (one candidate per block):
        - For each partial assignment, check row, column, region and adjacency constraints against the current board state.
        - If no complete assignment exists for `S`, discard `S`.
     4. Among all subsets for which at least one valid assignment exists, choose a subset of maximum cardinality and return it.
   - If `blocks.length > 15`, use a greedy strategy:
     1. Sort blocks by ascending number of candidate cells.
     2. Repeatedly pick the next block that does not overlap any already selected block and for which there exists at least one consistent assignment including all selected blocks so far.
     3. Return the final set.

4. The consistency check used in backtracking must be implemented in a dedicated helper in `blockHelpers.ts`:

   ```ts
   function assignmentsAreValid(
     state: BoardState,
     assignments: CellId[]
   ): boolean
   ```

   This helper must:

   - Count existing stars in rows, columns and regions.
   - Add stars at the `assignments` cells and ensure none of the quotas are exceeded.
   - Ensure no assigned star is adjacent (8‑way) to an existing star or to another assigned star.

After this change, for the **row band 3–4** in the C2 test:

- `computeRemainingStarsInBand` must return `3`.
- `getMaxNonOverlappingBlocksInBand` must return a set of 3 non‑overlapping valid blocks that are compatible with all constraints.

This correct C1 computation is a prerequisite for C2 to fire.

---

## 3. Region band quota logic: `getRegionBandQuota`

**File:** `src/logic/schemas/helpers/bandHelpers.ts`  
**Function:**

```ts
export function getRegionBandQuota(
  region: Region,
  band: RowBand | ColumnBand,
  state: BoardState,
  recursionDepth: number = 0
): number
```

This function currently implements a combination of A1 and A3 reasoning with recursion control. Adjust it so that it satisfies the following rules, while keeping the existing A1/A3 structure:

1. Compute the **total remaining stars for the region**:

   ```ts
   const remainingInRegion = region.starsRequired - getStarCountInRegion(region, state);
   ```

2. Compute:

   - `allCellsInBand` = `getAllCellsOfRegionInBand(region, band, state)` (includes stars, crosses and unknowns).
   - `starsInBand` = count of cells in `allCellsInBand` whose state is `CellState.Star`.
   - `candidatesInBand` = `getCellsOfRegionInBand(region, band, state)` (unknown cells).

3. If `candidatesInBand.length === 0`, return `starsInBand` as the **exact quota**: the region cannot place additional stars in the band.

4. If the region is fully inside the band (all its cells are inside `band.rows` or `band.cols`), return `region.starsRequired` as the **exact quota**.

5. For partial regions (not fully inside band), compute a **minimum and maximum** number of stars possible in this band:

   - **Maximum in band** = the maximum number of stars that can still be placed in `candidatesInBand` without violating row, column, region or adjacency constraints. Implement this via a local backtracking search restricted to cells in `candidatesInBand`.
   - **Maximum outside band** = the maximum number of stars that can still be placed in `region.cells` \ `allCellsInBand` (the complement) without violating constraints.

   Then compute:

   ```ts
   const minInBand = Math.max(0, remainingInRegion - maxOutsideBand);
   const maxInBand = Math.min(remainingInRegion, maxInBandLocal);
   ```

6. If `minInBand === maxInBand`, return this value as an **exact quota** for the band. Otherwise, return the conservative value `starsInBand`.

7. When `recursionDepth > 1`, keep the safeguard: simply return `starsInBand` without performing the local searches.

Apply this logic equally for row bands and column bands. Use existing helpers for enumerating bands and for region membership where possible, but ensure that the minima and maxima above are computed explicitly.

After this change, for the C2 test puzzle:

- For **region 4** (puzzle region 3) and the **row band 0–2**, `getRegionBandQuota` must return `1`.
- For the same region and the **row band 3–4**, `getRegionBandQuota` must also correctly reflect that exactly one star must be placed in rows 3–4 once the constraints from rows 0–2 are taken into account.

---

## 4. C2 schema implementation: `C2_cagesRegionQuota.ts`

**File:** `src/logic/schemas/schemas/C2_cagesRegionQuota.ts`

The C2 schema is responsible for deducing crosses in a band based on:

- C1: the number of cages (valid 2×2 blocks) equals the number of remaining stars in a band.
- Region band quotas: `getRegionBandQuota` yields exact quotas for regions in that band.

Update `C2_cagesRegionQuota.ts` to follow these rules:

1. For each **row band** `B` with exactly two rows (bands of length 2 only):

   - Compute `remaining = computeRemainingStarsInBand(B, state)`.
   - Compute `validBlocks = getValidBlocksInBand(B, state)`.
   - Compute `maxBlocks = getMaxNonOverlappingBlocksInBand(B, state)`.

   C1 holds when `maxBlocks.length === remaining`. Only consider bands where C1 holds.

2. For each region `R` that intersects the band:

   - Compute `quota = getRegionBandQuota(R, B, state)`.
   - Compute `cellsInBand = getAllCellsOfRegionInBand(R, B, state)`.
   - Compute `unknownInBand = cellsInBand.filter(c => state.cellStates[c] === CellState.Unknown)`.
   - If `quota === 0` or `unknownInBand.length === 0`, skip this region.

3. For C2, focus on regions where

   - `quota > 0`, and
   - there exists at least one valid block in `maxBlocks` that is **fully inside the region** and inside the band.

   More precisely, define:

   ```ts
   const regionCellSet = new Set(R.cells);
   const fullBlocksInRegion = maxBlocks.filter(block =>
     block.cells.every(cellId => regionCellSet.has(cellId))
   );
   ```

4. The C2 condition for a region `R` in band `B` is:

   - C1 holds (`maxBlocks.length === remaining`).
   - `quota > 0`.
   - `fullBlocksInRegion.length === quota`.
   - For all other candidate cells of `R` in the band that are not in those `fullBlocksInRegion`, stars are impossible and must be crosses.

5. When C2 holds, the schema must emit **cell deductions** of type `forceEmpty` for every `CellId` in:

   ```ts
   const fullBlockCellSet = new Set<number>();
   for (const block of fullBlocksInRegion) {
     for (const cellId of block.cells) {
       fullBlockCellSet.add(cellId);
     }
   }

   const forcedCrossCells = unknownInBand.filter(cellId => !fullBlockCellSet.has(cellId));
   ```

   For each `cellId` in `forcedCrossCells`, create a deduction:

   ```ts
   {
     type: 'forceEmpty',
     cell: cellId
   }
   ```

   The schema application object returned by `C2Schema` must include these deductions and a clear explanation string referencing the band, region and C1/C2 logic.

After this change, in the C2 test puzzle, the C2 schema must produce deductions that mark **all unknown cells in area C in rows 3–4** that are not part of the unique fully‑inside cage as forced crosses.

---

## 5. Schema‑based technique: `schemaBased.ts`

**File:** `src/logic/techniques/schemaBased.ts`

The schema‑based technique already exposes two functions:

- `findSchemaBasedHint(state: PuzzleState): Hint | null`
- `findSchemaBasedResult(state: PuzzleState): TechniqueResult`

Make the following adjustments:

1. Ensure `findSchemaBasedResult` always calls `getAllSchemaApplications(state)` first and converts every schema deduction into a `CellDeduction` or other `Deduction` types defined in `src/types/deductions.ts`. Do not skip any schema application produced by `C2_cagesRegionQuota`.

2. Keep `findSchemaBasedHint` as a *validation wrapper*: it may call `findSchemaHints(state)` to produce a `Hint`, then build a candidate `PuzzleState` by applying the proposed changes, and verify that `validateState` passes. If validation fails, `findSchemaBasedHint` must return `null`.

3. In `findSchemaBasedResult`, keep the following behaviour:

   - If `findSchemaBasedHint(state)` returns a non‑null hint, return:

     ```ts
     { type: 'hint', hint, deductions: allSchemaDeductionsOrUndefined }
     ```

     where `allSchemaDeductionsOrUndefined` is the array of all deductions created from `getAllSchemaApplications(state)`, or `undefined` if the array is empty.

   - If `findSchemaBasedHint(state)` returns `null` but the deductions array is non‑empty, return:

     ```ts
     { type: 'deductions', deductions }
     ```

   - If no schema produced any deduction, return `{ type: 'none' }`.

4. Confirm that `src/logic/techniques.ts` still calls `findSchemaBasedHint` and `findSchemaBasedResult` in the same way as other techniques.

After the fixes in sections 2–4, C2 deductions will flow through `findSchemaBasedResult` and `mainSolver.analyzeDeductions` and will appear as either a schema‑based hint or as supporting deductions for another hint.

---

## 6. Rewrite `tests/C2_specificCase.test.ts` to assert behaviour

**File:** `tests/C2_specificCase.test.ts`

Replace the current “debug harness” body with a deterministic test that does the following:

1. Uses the existing `parsePuzzle` helper in the same file to create a `PuzzleState` from the provided `puzzleStr` literal.

2. Converts the `PuzzleState` to `BoardState` using `puzzleStateToBoardState`.

3. Verifies the **precondition about rows 0–2 and region 4**:

   - Find the row band `rowBand012` corresponding to rows 0–2 using `enumerateRowBands(boardState)`.
   - Find region `region4` in `boardState.regions` where `id === 4`.
   - Call `getRegionBandQuota(region4, rowBand012, boardState)` and assert that the result is exactly `1`.
   - Call `getAllCellsOfRegionInBand(region4, rowBand012, boardState)` and confirm that the number of stars in that band for region 4 is less than or equal to 1.

4. Verifies **C1 and the region 4 quota for rows 3–4**:

   - Find the row band `rowBand34` corresponding to rows 3–4.
   - Call `computeRemainingStarsInBand(rowBand34, boardState)` and assert that the result is `3`.
   - Call `getMaxNonOverlappingBlocksInBand(rowBand34, boardState)` and assert that the resulting array has length `3`.
   - Call `getRegionBandQuota(region4, rowBand34, boardState)` and assert that the result is `1`.

5. Verifies **C2 deductions for region 4 in rows 3–4**:

   - Call `applyAllSchemas(boardState)` (or the equivalent registry entry point) so that the C2 schema is executed.
   - Call `findSchemaHints(state)` and filter the results for applications of `C2_cagesRegionQuota`.
   - From these applications, collect all `forceEmpty` cell deductions for region 4 in rows 3–4.
   - Assert that there is at least one such deduction and that every deduced `forceEmpty` cell:
     - Belongs to region 4.
     - Is in row 3 or 4.
     - Is not part of the unique fully‑inside 2×2 cage that contains all cells of region 4 in that band.

6. Verifies that `findSchemaBasedHint(state)` returns a `Hint` whose `technique` is `"schema-based"` and whose `resultCells` include at least one cell in rows 3–4 of region 4 being set to `cross` (forced empty).

Remove all `console.log` calls and all comments that describe future “next steps”, as the test must now represent the final, working behaviour of the solver.

---

## 7. Final acceptance criteria

The code changes are complete when all the following are true:

1. The TypeScript project builds successfully with `pnpm test` or the equivalent test command.
2. The test `tests/C2_specificCase.test.ts` passes and contains no `expect(true).toBe(true)` or similar placeholder assertions.
3. For the `C2_specificCase` puzzle:
   - `getRegionBandQuota(region4, rowBand012, boardState)` returns `1`.
   - `getRegionBandQuota(region4, rowBand34, boardState)` reflects the enforced requirement of one star in rows 3–4.
   - `computeRemainingStarsInBand(rowBand34, boardState)` returns `3`.
   - `getMaxNonOverlappingBlocksInBand(rowBand34, boardState)` returns a set of 3 compatible non‑overlapping blocks.
   - The C2 schema produces `forceEmpty` deductions for all unknown cells of region 4 in rows 3–4 that are not part of the unique fully region‑covered cage.
4. `findSchemaBasedHint` returns a schema‑based hint on this puzzle that marks at least one such cell as a cross, and applying this hint preserves puzzle validity according to `validateState`.
5. All existing tests in `tests/*.test.ts` continue to pass.

Once these criteria are met, the solver’s schema‑based C2 band logic will be correctly wired, and the `C2_specificCase` will be solved as described:
- The star count in the first three rows forces exactly one star in area C.
- Counting valid 2×2 placements in rows 3–4 identifies a unique 2×2 cage fully in area C for that star.
- All other empty cells in area C in rows 3–4 are correctly deduced to be crosses.
