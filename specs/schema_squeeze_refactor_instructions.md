# Refactor squeeze into schema-based helper for C2_specificCase

These instructions are **mandatory**. Do **not** skip or reorder steps unless explicitly stated.

The goal is:

- Extract the core “squeeze” legality checks into shared helpers.
- Expose a schema-based squeeze step so that `C2_cagesRegionQuota` can benefit from it.
- Keep the existing `squeeze` technique working, but make it a thin wrapper around the shared helpers.
- Register the new schema in the schema engine so `C2_specificCase.test.ts` can pass.

Work in the `star-battle-solver` repository.

---

## 1. Add shared placement helpers for techniques

### 1.1 Create `src/logic/constraints/placement.ts`

Create a new file:

- **Path**: `src/logic/constraints/placement.ts`

In this file, implement **both** of the following helpers:

1. `isValidStarPlacement(state: PuzzleState, cell: Coords): boolean`  
2. `canPlaceAllStarsSimultaneously(state: PuzzleState, candidates: Coords[], starsPerUnit: number): Coords[] | null`

Requirements for `isValidStarPlacement`:

- Input types must come from existing types:
  - `PuzzleState` from `src/types/puzzle` (or the appropriate existing path).
  - `Coords` from the same place as used in `squeeze.ts` today.
- Return `false` if the cell is not empty.
- Enforce 2×2 constraint:
  - For each 2×2 block that includes `cell`, count existing stars in that block (excluding the candidate cell itself).
  - If there is at least one existing star, and placing another star at `cell` would create a 2×2 with > 1 star, return `false`.
- Enforce adjacency constraint:
  - Use the existing neighbor helper (e.g. `neighbors8`) and return `false` if any 8-neighbor already has a star.
- Otherwise return `true`.

Requirements for `canPlaceAllStarsSimultaneously`:

- It receives a `PuzzleState`, a list of `Coords`, and `starsPerUnit` (the stars-per-row/column/region value).
- It must **simulate placing all stars in `candidates` simultaneously** under:
  - No adjacency between any pair of candidate cells.
  - No adjacency between candidates and existing stars.
  - No unit (row, column, region) exceeding `starsPerUnit` when taking both existing stars and the new candidates into account.
- Implementation details:
  - Maintain a list of “accepted” candidate cells as you iterate.
  - For each `cell` in `candidates`:
    - Reject if it is adjacent (8-neighbour) to any existing star.
    - Reject if it is adjacent (8-neighbour) to any previously accepted candidate.
    - Compute stars in its row, column, and region **including** previously accepted candidates, and reject if any would exceed `starsPerUnit`.
  - If any check fails, return `null`.
  - If all candidates pass, return the `candidates` array (or a copy).

Do **not** reference any technique-specific code in this file. It must be reusable.

---

## 2. Refactor the existing `squeeze` technique to use the helpers

### 2.1 Update imports in `squeeze.ts`

Open:

- **Path**: `src/logic/techniques/squeeze.ts`

At the top of the file, add imports for the new helpers:

- `isValidStarPlacement` from `../constraints/placement`
- `canPlaceAllStarsSimultaneously` from `../constraints/placement`

### 2.2 Replace local helper usage

In `squeeze.ts`:

- Replace all calls to the old local helper `isValidPlacement` with `isValidStarPlacement`.
- Replace all calls to the old local helper `canPlaceAllStars` with `canPlaceAllStarsSimultaneously`.

Make sure all arguments match the new signatures.

### 2.3 Remove old local helpers

At the bottom of `squeeze.ts` there are currently local implementations of:

- `isValidPlacement(...)`
- `canPlaceAllStars(...)`

Remove these **entire** function definitions from `squeeze.ts`. The file must use only the shared helpers from `src/logic/constraints/placement.ts`.

Do **not** change the external API of `findSqueezeHint`. Tests that depend on `squeeze` must still compile and run.

---

## 3. Add placement helpers for schema-based board

Now add placement helpers on the **schema** side so schema logic can reason about valid placements.

### 3.1 Create `src/logic/schemas/helpers/placementHelpers.ts`

Create a new file:

- **Path**: `src/logic/schemas/helpers/placementHelpers.ts`

Implement:

```ts
export function isValidBoardPlacement(state: BoardState, cellId: CellId): boolean;
```

Requirements:

- Use the existing `BoardState` and `CellId` types from `src/logic/schemas/model/types` (or their existing location).
- Convert `cellId` to row/col with the existing helper (e.g. `cellIdToCoord`).
- Return `false` if the cell is not `Unknown` (i.e. it is already forced star or forced empty).
- Enforce 2×2 constraint:
  - Iterate over all 2×2 blocks that include this coordinate.
  - If any such block already contains a star in a *different* cell than `cellId`, and placing a star at `cellId` would violate the rule “at most one star per 2×2”, return `false`.
- Enforce adjacency constraint:
  - Use the existing neighbour helper for BoardState (e.g. `getNeighbors8`) to get all 8-neighbours of `cellId`.
  - If any 8-neighbour already contains a star, return `false`.
- Otherwise return `true`.

Do **not** add row/column/region quota checks here. Those are handled by the schema constraints.

---

## 4. Add a schema for region–line squeeze

Now implement a schema that performs a row+region / column+region squeeze at the schema level and emits forced stars.

### 4.1 Create `D3_regionBandSqueeze` schema file

Create:

- **Path**: `src/logic/schemas/schemas/D3_regionBandSqueeze.ts`

In this file, define a schema:

- `export const D3RegionBandSqueezeSchema: Schema = { ... }`

Requirements for the schema:

1. The schema **must** iterate over:
   - all rows × all regions, and
   - all columns × all regions.

2. For each **row + region** pair:

   - Get the row’s cells and region’s cells from the existing schema state (`state.rows`, `state.cols`, `state.regions`).
   - Compute the remaining stars for the row and region:
     - `rowStars` = number of stars in the row.
     - `regionStars` = number of stars in the region.
     - `rowRemaining = starsPerLine - rowStars`.
     - `regionRemaining = starsPerLine - regionStars`.
     - If `rowRemaining <= 0` or `regionRemaining <= 0`, skip this pair.

   - Determine the **intersection shape**:
     - `shape` = cells that are in both the row and the region.

   - Collect valid candidates:
     - For the row: all row cells where the BoardState cell is `Unknown` and `isValidBoardPlacement` returns `true`.
     - For the region: same approach.

   - Split the row and region candidates into:
     - those inside `shape` and
     - those outside `shape`.

   - Let:
     - `rowValidOutside` = number of valid row candidates outside `shape`.
     - `regionValidOutside` = number of valid region candidates outside `shape`.

   - Compute the needed stars in `shape`:
     - `rowNeeded = max(0, rowRemaining - rowValidOutside)`
     - `regionNeeded = max(0, regionRemaining - regionValidOutside)`
     - `starsForced = max(rowNeeded, regionNeeded)`

   - If `starsForced <= 0`, skip.
   - Let `shapeCandidates` be the valid candidates in `shape` (`Unknown` + `isValidBoardPlacement`).
   - If `shapeCandidates.length === starsForced`, then:
     - **All cells in `shapeCandidates` must be stars**.

   - Emit a `SchemaApplication` that:
     - forces `CellState.Star` in all `shapeCandidates` (using the existing “forceStar” deduction type),
     - includes an `explanation` referencing the row and region.

3. For each **column + region** pair:

   - Repeat the exact logic above, but using columns instead of rows.

4. The schema’s `id`.

   - Use `id: 'D3_regionBandSqueeze'`.
   - Set `kind` and `priority` consistent with other core schemas (for example `kind: 'core'`, `priority: 3`).
   - This schema must run **before** `C2_cagesRegionQuota`, so C2 sees the stars forced by the squeeze.

Make sure the new schema file compiles and matches existing schema types (`Schema`, `SchemaContext`, `SchemaApplication`, etc.).

---

## 5. Register the new schema

Open:

- **Path**: `src/logic/schemas/index.ts` (or the main schema registration file).

In the section where schemas are imported:

- Add an import for `D3RegionBandSqueezeSchema` from `'./schemas/D3_regionBandSqueeze'`.

In the section where schemas are registered (e.g. `registerSchema(...)` calls):

- Insert `registerSchema(D3RegionBandSqueezeSchema);`
- Make sure it is registered **before** `C2_cagesRegionQuota` (and after any schemas that establish basic row/column/region counting that it depends on).

Do not change the order of other schemas unless strictly necessary for compilation. Only insert this new one in the appropriate place.

---

## 6. Keep the `squeeze` technique as a thin adapter

Confirm that `src/logic/techniques/squeeze.ts` now:

- Depends on `isValidStarPlacement` and `canPlaceAllStarsSimultaneously` from `../constraints/placement`.
- Still returns the same `Hint` structure as before.
- Uses the same high-level logic (row/col/region intersection squeeze and “only k valid cells for k stars” reasoning).

Do **not** make it call the schema engine. The technique should remain an independent, imperative hint generator.

---

## 7. Run and fix tests

1. Run the full test suite, including schema-related tests, for example:

   - `npm test`
   - or the project’s documented test command.

2. Specifically ensure that:

   - `C2_specificCase.test.ts` compiles and runs.
   - If it still fails, inspect the failure and adjust the `D3_regionBandSqueeze` schema so that the squeeze stars are applied **before** the C2 logic runs.

3. Do **not** weaken existing techniques or schemas to “make the test pass”. The new schema is intended to add strength by making squeeze information available in schema-based reasoning.

---

## 8. Clean-up and consistency checks

- Ensure there is no duplicate logic for 2×2 adjacency checks between technique and schema layers:
  - Techniques must use `src/logic/constraints/placement.ts`.
  - Schemas must use `src/logic/schemas/helpers/placementHelpers.ts`.
- Ensure names and exports match project conventions:
  - Filenames, exported constants, and schema IDs should be consistent.

Do not skip any of these steps. Each step is required for schema-based squeeze support to work and for `C2_cagesRegionQuota` (and `C2_specificCase.test.ts`) to benefit from it.
