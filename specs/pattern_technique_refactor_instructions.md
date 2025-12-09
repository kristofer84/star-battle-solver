# Pattern Technique Refactor Instructions  
### (Update “M”, “Kissing L”, “Pressured T”, etc. to use shared squeeze helpers)

These steps are **mandatory**. Do **not** skip, reorder, or simplify steps unless explicitly stated.

The goal is:

- Ensure that *all* pattern techniques use the **shared legality logic** introduced for squeeze (`isValidStarPlacement`, `canPlaceAllStarsSimultaneously`).  
- Remove duplicated adjacency / 2×2 code in pattern techniques.  
- Ensure pattern techniques are consistent with schema-based reasoning and the refactored squeeze system.

Work in the `star-battle-solver` repository.

---

## 1. Identify all pattern techniques to update

Search under:

- `src/logic/techniques/patterns`
- `src/logic/techniques/advanced`
- or wherever these pattern files live.

Locate techniques implementing:

- **The M**
- **Kissing Ls**
- **Pressured Ts**
- Any other pattern that:
  - checks adjacency manually,
  - checks 2×2 blocks manually,
  - checks whether multiple cells can be stars at once.

You must update *each* such technique.

---

## 2. Add imports for the shared helpers

For **each** pattern technique file that needs refactoring:

1. At the top of the file, **add**:

```ts
import {
  isValidStarPlacement,
  canPlaceAllStarsSimultaneously,
} from '../constraints/placement';
```

(adjust the relative path as needed depending on folder structure)

2. Remove any local imports of obsolete helpers such as:
   - `isValidPlacement`
   - `hasAdjacentStar`
   - `violates2x2`
   - any hand-written adjacency or 2×2 logic

---

## 3. Replace all *single-cell legality checks* with `isValidStarPlacement`

In every pattern technique file:

### 3.1 Search for these patterns:

- Manual checking of adjacency, e.g.:

  ```ts
  neighbors8(cell).some(c => ...)
  ```

- Manual checking of 2×2 blocks:

  ```ts
  for (let dr = -1; dr <= 0; dr++)
  for (let dc = -1; dc <= 0; dc++)
  ```

- Hand-written placement checks like:

  ```ts
  if (!isEmpty(cell)) return false;
  if (adjacentStar(...)) return false;
  if (creates2x2(...)) return false;
  ```

### 3.2 Replace them with:

```ts
if (!isValidStarPlacement(state, cell)) {
  continue; // OR return null; OR skip candidate — match original flow
}
```

This removes duplicated rules and ensures consistency with squeeze and schema-based logic.

---

## 4. Replace *multi-cell legality checks* with `canPlaceAllStarsSimultaneously`

Any technique that decides:

> “the pattern forces **all these cells** to be stars”

must verify that placing them simultaneously is legal.

### 4.1 Search for code resembling:

- manual cross-checking adjacency between forced cells:

  ```ts
  for (const a of forcedCells)
    for (const b of forcedCells)
       if (adjacent(a,b)) return null;
  ```

- manual row/column/region quota checks:

  ```ts
  if (rowStars + forcedInRow > starsPerUnit) return null;
  ```

- ad-hoc helpers like:

  - `canPlaceAllStars`
  - `allStarsPossible`
  - `verifyGroupDoesNotBreakRules`

### 4.2 Replace the entire logic with:

```ts
const validated = canPlaceAllStarsSimultaneously(state, forcedCells, state.def.starsPerRow);
if (!validated) {
  return null; // or skip deduction, preserving technique logic
}
```

This ensures all pattern techniques evaluate *joint* star placements the same way.

---

## 5. Remove obsolete local helpers

After replacing the logic:

1. Delete any functions in the file that duplicate placement logic, e.g.:

   - `isValidPlacement`
   - `isLegalStarHere`
   - `noAdjacencyViolation`
   - `check2x2`
   - `canPlaceTogether`
   - any helper containing adjacency / 2×2 rules

2. Ensure the file compiles without referencing removed code.

---

## 6. Verify technique behaviour remains unchanged except for legality corrections

The goal is **not** to alter the logical conditions that *trigger* the pattern, only:

- how candidate star placements are validated,
- how multi-star forced groups are checked.

Perform these checks:

### 6.1 Techniques should behave the same on valid puzzles.
### 6.2 Techniques should no longer accept illegal candidate placements.
### 6.3 Techniques should no longer reject legal placements because of incomplete local checks.

---

## 7. Run the test suite

Execute the project’s test command.

Verify that:

- All pattern tests pass.
- No pattern technique produces illegal moves.
- No pattern technique is now too weak (missing placements because of incorrect refactor).
- `C2_specificCase.test.ts` still passes.

---

## 8. Final clean-up

For each updated file:

- Ensure at top:

  - Shared helpers imported only once.
  - No remaining obsolete helper imports.

- Ensure no duplicated placement logic remains.

- Ensure comments refer to the shared helpers where appropriate.

Example:

```ts
// Validate star placement under 2×2 and adjacency rules
if (!isValidStarPlacement(state, cell)) continue;
```

Do **not** skip any step. Each step is mandatory for unified, correct pattern logic.
