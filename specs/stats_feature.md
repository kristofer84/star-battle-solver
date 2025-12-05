## Feature: Stats-Driven Constraints and Subset Constraint Squeeze

### Summary

Add a generalized **stats/constraints layer** and a **subset constraint squeeze** propagation step to the Star Battle solver.

The goal is to capture patterns such as:

> “Region C must have exactly 1 star in these rows, and 2×2 logic forces that star into this smaller subset. Therefore all other cells in that band become `x`.”

instead of hard-coding a specific “banded region” technique.

This feature introduces:

1. A **derived statistics module** that computes structured constraints from the current grid.
2. A generic **Constraint** representation over sets of cells.
3. A **subset constraint squeeze** rule that eliminates candidates whenever a smaller constraint is “responsible” for all stars counted by a larger one.
4. A way for existing and future techniques (including banded region logic) to be expressed via this shared machinery.

---

## Objectives

* Factor common counting results (rows, columns, regions, bands, 2×2 blocks) into a reusable stats layer.
* Express many techniques as interactions between constraints, rather than special-case code.
* Make “banded region squeeze” and similar ideas a special case of a generic **subset constraint squeeze**.
* Keep the core grid model unchanged: cells remain {unknown, star, x} with regions and standard row/column constraints.

---

## Core Concepts

### 1. Constraint

Introduce a general constraint object:

```text
Constraint {
    cells: BitSet        // candidate cells this constraint talks about
    minStars: u8         // lower bound on stars in `cells`
    maxStars: u8         // upper bound on stars in `cells`
}
```

Interpretation:

* The puzzle state plus counting logic imply:

  * At least `minStars` stars in `cells`.
  * At most `maxStars` stars in `cells`.

Special cases:

* **Exact**: `minStars == maxStars` → “exactly k stars in this set”.
* Empty set: `cells.is_empty()` should imply `minStars = maxStars = 0`.

### 2. Types of constraints provided by stats

From the current grid, the stats layer should be able to produce constraints for:

1. **Rows**

   * For each row `r`:

     * `cells` = all non-fixed (`unknown`) cells in row `r`.
     * `minStars` / `maxStars` = computed from required stars per row minus already placed stars and impossibilities.

2. **Columns**

   * For each column `c`:

     * `cells` = all non-fixed cells in column `c`.
     * Bounds similar to rows.

3. **Regions**

   * For each region `R`:

     * `cells` = all non-fixed cells in `R`.
     * Bounds based on region star quota and placed stars.

4. **Region × row bands**

   * For any region `R` and band of rows `[rStart..rEnd]` that a technique cares about:

     * `cells` = cells of region `R` within those rows, still `unknown`.
     * `minStars` / `maxStars` derived from:

       * global stars required for `R`, minus stars outside the band, minus impossibilities.
     * This covers facts such as “Region C has exactly 1 star in rows 1–3”.

5. **Local blocks (e.g. 2×2)**

   * For each 2×2 block (or other local pattern) where existing logic provides star bounds:

     * `cells` = cells in that block (or block ∩ a region, if the logic is region-specific).
     * `minStars` / `maxStars` according to the local tiling rules.
     * Example: “This 2×2 can contain at most 1 star from region C” or “must contain exactly 1 star from region C”.

The stats layer does not need to guess arbitrary subsets. It only needs to support these structured families that techniques already use or will use.

---

## Subset Constraint Squeeze

The main new logical engine is a generic rule that works on any two constraints with a subset relationship.

### 1. Star localization rule

Let `Csmall` and `Clarge` be constraints with:

* `Csmall.cells ⊆ Clarge.cells` (subset of candidate cells), and
* `Csmall.minStars == Clarge.maxStars == k`.

Then **all k stars that `Clarge` talks about must lie inside `Csmall.cells`**.

Consequences:

* For every cell `c ∈ Clarge.cells \ Csmall.cells`:

  * `c` cannot be a star.
  * Mark cell `c` as `x` (no star).

Intuition:

* `Clarge` says: “There are at most k stars in these big cells.”
* `Csmall` says: “There are at least k stars in this smaller subset.”
* The only way to satisfy both is: exactly k stars, all in `Csmall.cells`.

This covers:

* “Region R has exactly 1 star in rows 1–3” (Clarge) and
* “Local 2×2 logic forces a star into this 2×2 inside those rows” (Csmall)
  → all other cells of region R in those rows become `x`.

That is precisely the “banded region squeeze” scenario, but generalized.

### 2. Optional dual: non-star localization

Define for any constraint:

* `size = cells.count()`.
* `minNonStars = size - maxStars`.
* `maxNonStars = size - minStars`.

These are bounds on non-stars in `cells`.

For `Csmall ⊆ Clarge`, if:

* `Csmall.minNonStars == Clarge.maxNonStars == m`,

then all `m` non-stars of `Clarge` must lie in `Csmall.cells`, so every cell in `Clarge.cells \ Csmall.cells` must be a star.

Consequences:

* For every `c ∈ Clarge.cells \ Csmall.cells`:

  * Mark cell `c` as `star`.

This is the logical dual of the star localization rule. It might be less common in Star Battle, but can be implemented at the same time for completeness.

---

## Algorithmic Outline

### 1. Stats computation

At a chosen point in the solving loop (e.g. after each batch of changes):

1. Scan current grid state.
2. Compute:

   * Row stats and corresponding row constraints.
   * Column stats and constraints.
   * Region stats and constraints.
   * Region×row-band constraints for any bands used by higher-level techniques.
   * Local block (2×2, etc.) constraints based on existing tiling logic.

These constraints can be collected into a list or grouped by type.

Implementation note:
Initially, recompute these statistics from scratch after each propagation step. The grids are small enough that performance should be acceptable. Incremental updates can be added later if needed.

### 2. Subset detection

We need to find pairs `(Csmall, Clarge)` with `Csmall.cells ⊆ Clarge.cells`.

Because the solver will generate only structured constraints, the search can be limited:

* Only compare constraints within sensible families:

  * Row-based vs region-band constraints.
  * Region constraints vs region-band constraints.
  * Region-band constraints vs 2×2 sub-blocks in that band.
* Use bitsets for `cells` so subset test is a fast:

  * `Csmall.cells & ~Clarge.cells == 0`.

Do not perform an O(N²) subset search over all constraints if it becomes expensive. Restrict to known patterns:

* Region × band vs sub-block for that region and overlapping rows.
* Row constraint vs 2×2 blocks that lie inside that row.
* Similar structured relations.

### 3. Apply subset constraint squeeze

For each pair `(Csmall, Clarge)` with subset relation:

1. Check star localization rule:

   ```pseudo
   if Csmall.minStars == Clarge.maxStars:
       k = Csmall.minStars
       if k > 0:
           for each cell c in (Clarge.cells \ Csmall.cells):
               eliminate star candidate → mark as x
   ```

2. Optionally, check non-star localization rule:

   ```pseudo
   size_small = Csmall.cells.count()
   size_large = Clarge.cells.count()

   Csmall_minNon = size_small - Csmall.maxStars
   Clarge_maxNon = size_large - Clarge.minStars

   if Csmall_minNon == Clarge_maxNon:
       m = Csmall_minNon
       if m > 0:
           for each cell c in (Clarge.cells \ Csmall.cells):
               force star in c
   ```

3. Any newly determined `x` or `star` should be recorded as changes to the grid state.

4. After applying all such squeezes, re-run other propagation steps (row/column completion, adjacency, etc.), then recompute stats if the grid has changed, until a fixed point is reached.

---

## Integration with Existing Techniques

* Existing techniques that already compute min/max stars for rows, columns, regions, 2×2 blocks, or bands can be rephrased to produce **constraints** instead of performing all eliminations directly.
* Some techniques may still perform direct grid updates. That is fine; the stats layer can be recomputed after such updates.
* “Banded region squeeze” is no longer a separate special technique:

  * It appears naturally when a **region×band constraint** and a **smaller 2×2 (or similar) constraint** meet the subset squeezing conditions.
  * For human-readable explanations, you can still label this outcome as “banded region squeeze” when the pattern matches a recognized region×band + 2×2 scenario.

---

## API Sketch

The following is a conceptual API to guide implementation. Adapt names and signatures to the project style.

```rust
// Example types; adjust to actual codebase structures

struct Constraint {
    cells: BitSet<CellId>,
    min_stars: u8,
    max_stars: u8,
}

struct Stats {
    row_constraints: Vec<Constraint>,
    col_constraints: Vec<Constraint>,
    region_constraints: Vec<Constraint>,
    region_band_constraints: Vec<Constraint>,
    local_block_constraints: Vec<Constraint>, // e.g. 2×2
}

fn compute_stats(grid: &Grid) -> Stats {
    // 1. Analyze grid
    // 2. Fill each of the constraint collections
}

fn apply_subset_constraint_squeeze(grid: &mut Grid, stats: &Stats) -> bool {
    let mut changed = false;

    let all_constraints = stats.all_constraints(); // flatten or iterate by relevant pairs

    for (c_small, c_large) in subset_pairs(&all_constraints) {
        // Star localization
        if c_small.min_stars == c_large.max_stars && c_small.min_stars > 0 {
            let diff = c_large.cells.difference(&c_small.cells);
            for cell in diff {
                if grid.can_place_star(cell) {
                    grid.set_x(cell);
                    changed = true;
                }
            }
        }

        // Optionally: non-star localization
        // ...
    }

    changed
}
```

The main solving loop can then:

1. Apply all “direct” techniques.
2. Compute `stats`.
3. Run `apply_subset_constraint_squeeze`.
4. Repeat until no changes.

---

## Explanation Text for Users (Optional)

If the solver has an explanation mode, this generic feature can produce user-facing messages such as:

> **Subset constraint squeeze:**
> Region C must have exactly 1 star in rows 1–3.
> In addition, 2×2 logic shows that this 1 star must lie in the 2×2 block at rows 3–4, columns 4–5.
> Therefore all other cells of region C in rows 1–3 cannot contain a star and are marked as empty.

This is the human description of the same generic subset-constraint rule.