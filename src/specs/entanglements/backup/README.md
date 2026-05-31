# Entanglement Pattern Backups

This directory contains pattern files that have been removed from the active app bundle.
None of these files are imported by `src/specs/entanglements/index.ts`.

---

## 1. `10x10-2star-entanglements-triple-entanglements-adjacent-invalid.json`

**Why removed:** These 762 unconstrained triple rules describe patterns where the
`canonical_candidate` cell is **adjacent** (within 1 cell diagonally or orthogonally,
i.e. |rowDiff| ≤ 1 AND |colDiff| ≤ 1) to at least one of the `canonical_stars`.

In Star Battle, no two stars may be adjacent, so any cell adjacent to a placed star is
*already* forced empty by the basic adjacency rule. These entanglement patterns therefore
add no new information and will **never fire**: `applyTripleRule()` in
`src/logic/entanglements/matcher.ts` (around line 257) already performs an explicit
adjacency safety check and skips candidates that are adjacent to a matched star.

Example — pattern `21f369`:
- `canonical_stars`: `[[0,0],[0,2]]`
- `canonical_candidate`: `[-1,-1]` — diagonally adjacent to star `[0,0]`

**How to restore:** Add these rules back into `unconstrained_rules` in the main
`10x10-2star-entanglements-triple-entanglements.json` file. They will still never
produce solver hints, but keeping them out avoids iterating over dead patterns at runtime.

---

## 2. `10x10-2star-entanglements.json`

**Why removed:** This file contains **pair-based** entanglement patterns (absolute board
coordinates of two initial stars and their resulting forced-empty/forced-star cells across
all compatible solutions). The active solver technique `entanglementPatterns.ts` only
processes specs with `hasTriplePatterns = true`. Pair specs are parsed and stored as
`pairData` on `LoadedEntanglementSpec`, but no technique ever reads `pairData` to produce
hints.

Keeping this large file (106 KB) in the bundle added parse overhead with zero runtime benefit.

**How to restore:** Re-add the import and entry to `src/specs/entanglements/index.ts`.
A future technique could use `pairData` for pair-based deductions.

---

## 3. `10x10-2star-entanglements-constrained-entanglements.json`

**Why removed:** This file contains constrained entanglement rules that use
`canonical_forced_empty` (multiple forced cells per rule) instead of a single
`canonical_candidate`. The loader parses these as `constrainedData`, but
`entanglementPatterns.ts` only iterates over `spec.tripleData` — `constrainedData`
is never accessed by any active technique.

**How to restore:** Re-add the import and entry to `src/specs/entanglements/index.ts`,
then implement a matcher (similar to `applyTripleRule` in `matcher.ts`) that processes
`ConstrainedRule` entries.

---

## 4. `10x10-2star-entanglements-pure-entanglements.json`

**Why removed:** Same reason as the constrained file above. Pure entanglement templates
specify `canonical_stars` and `canonical_forced_empty` without constraint features. The
loader parses them as `pureData`, but no technique reads `pureData`.

**How to restore:** Re-add the import and entry to `src/specs/entanglements/index.ts`,
then implement a matcher for `PureEntanglementTemplate` entries.
