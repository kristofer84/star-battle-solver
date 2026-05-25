# Solver Techniques Reference

Star Battle rules (10×10, 2-star variant):
- Place exactly 2 stars in every row, column, and region.
- No two stars may touch, even diagonally (8-directional adjacency).

---

## How the Solver Loop Works

Each call to `findNextHint` iterates over `techniquesInOrder` and handles two kinds of results:

### Direct hints (`type: 'hint'`)
The technique is certain: it returns a specific set of cells to mark as stars or crosses. Star hints are returned immediately; the loop keeps scanning for a star hint when it finds a cross hint first, then returns the cross if no star is found before the first expensive technique.

### Deductions (`type: 'deductions'`)
The technique is not yet certain enough to produce a move, but it contributes partial information (e.g. "region A has at least 1 star in columns 3–5"). These accumulate in a pool. After each technique runs, `analyzeDeductionsWithContext` combines everything in the pool and checks whether the combined information resolves to a forced cell. When it does, the *last technique to contribute the decisive deduction* is credited as the "winner," but the log also shows `via: …` for every earlier technique whose deduction was part of the pool.

This is why **deduction-emitting techniques must run before the technique that ultimately triggers the move**: if 2×2 Blocks emits `forceEmpty` for a cell at step 3, and Exact Fill resolves that to a star at step 7, removing 2×2 Blocks would prevent that star from being found until a different technique rediscovers it.

### Technique return types

| Return type | Description |
|---|---|
| `hint` | Immediate, certain move. |
| `deductions` | Partial facts that accumulate across techniques. |
| `none` | Nothing found. |

---

## Ordering Principles

1. **Cheap and certain before expensive**: Trivial Marks runs in microseconds. By a Thread spends seconds per cell. Running expensive techniques before cheap ones wastes time on every step.
2. **High win-rate before low win-rate**: Among expensive techniques, order by how often each one is the deciding factor (from benchmark data). Overcounting wins 479 times per 1000 puzzles; Partial Undercounting wins 24 times — so Overcounting runs first.
3. **Deduction enablers before hint resolvers**: 2×2 Blocks emits `CellDeduction forceEmpty` for every empty cell in a star-containing 2×2. These deductions feed the pool. Other techniques then combine them with their own deductions to reach moves. 2×2 must run early every step; moving it after the counting techniques would break that chain.
4. **Cross hints yield to star hints**: Finding a cross is useful but a star is more informative. The solver collects the first cross hint, continues scanning non-expensive techniques for a star, then falls back to the cross if none is found.
5. **Search techniques last**: By a Thread and By a Thread at Sea enumerate cell hypotheses with full search. They are correct but expensive and should only run when every other technique is exhausted.

---

## Technique Reference

### Basics

These run every step, are cheap (microseconds to low milliseconds), and handle the most direct consequences of the placement rules.

#### Trivial Marks
Emits `forceEmpty` for any empty cell that is 8-adjacent to an existing star (stars cannot touch), and for any cell in a row/column/region that already has its full quota of stars. These are always valid and always checked first.
- **Output**: `CellDeduction forceEmpty`
- **Benchmark**: ~24.9% of all winning steps (#1 overall)

#### Locked Row/Column
When every valid placement for a region's remaining stars falls within a single row or column, all other cells in that row/column outside the region must be crosses. Example: a 1×4 horizontal region can only place its stars in that one row; no other region needs that row for stars.
- **Output**: direct `hint (place-cross)`
- **Benchmark**: ~3.8% of winning steps

#### Saturation
When a row, column, or region has already placed all required stars, remaining empty cells in that unit are crosses. This is the "quota met → empties become crosses" rule and is essentially the complement of Trivial Marks.
- **Output**: direct `hint (place-cross)` or `CellDeduction forceEmpty`
- **Benchmark**: low direct wins, but fuels many downstream deductions

#### Adjacent Row/Column
For a contiguous run of empty cells in a row or column: if the run length equals `2k−1` (where k is remaining stars needed), all cells must be stars. If the run length equals `2k`, the cells adjacent to the gaps must be crosses (they cannot both be stars because adjacency).
- **Output**: direct `hint (place-star or place-cross)`

#### 2×2 Blocks
Any 2×2 window of cells may contain at most one star. When a 2×2 block already has one star, all remaining empty cells in that block must be crosses.
- **Output**: `CellDeduction forceEmpty` for each empty cell in a 1-star block
- **Benchmark**: 0 direct wins, but **fuels ~38% of all winning steps** — the single most important deduction enabler. Must run early every step.

#### Exact Fill
When a unit (row, column, or region) has exactly as many remaining empty cells as remaining stars needed, and no two of those cells are 8-adjacent, all of them must be stars.
- **Output**: direct `hint (place-star)` or `CellDeduction forceStar`
- **Benchmark**: ~5.3% of winning steps

#### Simple Shapes
Recognizes common region shapes (1×4/4×1 strips, L-shapes, T-shapes, S/Z-shapes, 2×2 squares, etc.) and applies pre-computed shape logic. For example, a 1×4 horizontal strip with 2 stars needed: stars must go in alternating cells, crosses fill the rest. Uses a pre-computed catalog for O(1) shape lookup.
- **Output**: direct `hint` or `CellDeduction`
- **Benchmark**: ~24.9% of winning steps (#1 or #2 overall)

---

### Exclusion Family

These identify cells that *cannot* be stars because placing one there would prevent some unit from reaching its quota.

#### Exclusion
For each empty cell, checks whether placing a star there would leave any row, column, or region unable to place its remaining required stars (not enough valid cells remain). If yes, the cell must be a cross.
- **Output**: direct `hint (place-cross)`

#### Pressured Exclusion
Same idea as Exclusion but with a deeper check: after placing the hypothetical star and propagating immediate consequences (adjacency crosses, 2×2 crosses), checks again whether any unit is now undersupplied. Catches cases that plain Exclusion misses.
- **Output**: direct `hint (place-cross)`
- **Cost**: expensive (iterates over all empty cells with propagation)

#### Adjacent Exclusion
For each empty cell, checks whether all valid placements for a unit's remaining stars are 8-adjacent to that cell. If so, that cell cannot be a star (it would block all options for that unit).
- **Output**: direct `hint (place-cross)`
- **Cost**: expensive

#### Band Block Deficit
Within a horizontal or vertical band of N rows/columns, 2×2 blocks can absorb at most one star each. If the total band star capacity (blocked by existing crosses and 2×2 constraints) is tight, cells that would exceed the block budget must be crosses.
- **Output**: direct `hint (place-cross)`

#### Shared Row/Column
When multiple regions have all their valid placements confined to the same rows or columns (like Locked Row/Column but for multiple regions simultaneously), cells in those rows/columns belonging to other regions must be crosses.
- **Output**: direct `hint (place-cross)`
- **Cost**: expensive (scans all pairs/triples of regions)

#### Cross-Empty Patterns
Detects specific configurations where crosses and empty cells in a row/column force structural constraints. Example: a row with exactly 5 crosses and 5 adjacent empties in a known pattern forces the 2nd and 4th empties to be crosses (they cannot both be stars given adjacency).
- **Output**: direct `hint (place-cross)`

#### Cross Pressure
When a row/column has 7 crosses and 3 remaining empty cells (needing 2 stars), and the 3 empties are in a specific adjacency pattern, certain cells are forced. Three adjacent empties: the middle cell must be a star. Non-adjacent patterns: adjacency constraints force crosses.
- **Output**: direct `hint (place-star or place-cross)`

#### Forced Placement
Enumerates all valid star placements for a region. If a cell appears in every valid placement, it must be a star. Also projects: if every valid placement uses column C, other regions' cells in column C may become crosses.
- **Output**: direct `hint (place-star)`

---

### Case Split / Enumeration

#### Line Case-Split
For rows or columns with few remaining empty cells (≤4) and few remaining stars (≤2), enumerates all valid placements. Propagates each placement to fixed point. If a cell is forced in every non-contradictory branch, it is a forced move.
- **Output**: direct `hint (place-star or place-cross)`
- **Cost**: expensive (propagation per branch)
- **Benchmark**: ~332 wins per 1000 puzzles

#### Region Candidates
For each region, enumerates all valid subsets of `starsPerUnit` empty cells that satisfy: mutual non-adjacency, no adjacency to existing stars, and row/col quotas. Cells appearing in zero valid subsets must be crosses; cells in all valid subsets must be stars.
- **Output**: `CellDeduction forceEmpty/forceStar`
- **Benchmark**: ~30 wins per 200 puzzles; complements Line Case-Split with a region-centered view

#### Forcing Chains (Depth-1)
For each empty cell in a constrained unit (≤4 empty cells in its row, column, or region), tests two hypotheses:
1. Place star here + propagate → contradiction means the cell must be a cross.
2. Place cross here + propagate → contradiction means the cell must be a star.
The propagation applies all basic rules (adjacency, 2×2, quota, tightness) to fixed point. Depth-1 only (no recursive branching).
- **Output**: `CellDeduction forceEmpty/forceStar`
- **Benchmark**: ~184 wins per 200 puzzles (~1.9% of steps)

---

### Counting

These analyze groups of cells, rows, columns, and regions to derive lower and upper bounds on star counts, then use those bounds to force moves.

The counting section is **ordered by win rate from benchmark data**. Faster techniques that win more often run before slower ones that rarely win.

#### Overcounting (479 wins/1000, ~1.0%)
Identifies a set of regions whose valid placements are all confined within a fixed set of rows or columns. If the total star demand equals the line capacity, no other region can use those lines. Other cells in those lines are crosses.
- **Output**: direct `hint (place-cross)`
- **Cost**: expensive

#### Partial Overcounting (210 wins/1000, ~0.5%)
Variant of Overcounting that considers partial confinement: some but not all placements are confined. Derives upper bounds on how many stars can land outside the confined area.
- **Output**: direct `hint (place-cross)`
- **Cost**: expensive

#### Locked Outside Footprint (177 wins/1000, ~0.4%)
When a region's "footprint" (the minimal bounding box of its valid placements) is contained within a band of rows/columns, other regions sharing those rows/columns but outside the footprint are constrained.
- **Output**: direct `hint (place-cross)`
- **Cost**: expensive

#### Square Counting (28 wins/1000, ~0.1%)
Analyzes bands of 2 consecutive rows/columns using bitmask DFS with 2×2 block pruning. Finds forced moves by exhaustively enumerating placements within a band.
- **Output**: `BlockDeduction` or direct `hint`
- **Cost**: expensive (DFS per band)

#### Undercounting (~rare wins)
Computes a lower bound on how many stars must fall within a composite shape (union of rows + regions). If the minimum exceeds the cells available outside the shape, some must be stars inside. Uses search verification to confirm.
- **Output**: `AreaDeduction minStars`
- **Cost**: expensive

#### Partial Undercounting (24 wins/1000, ~0.1%)
Variant of Undercounting for partial overlaps. Very slow (avg 16622ms wasted before winning) and rarely decisive — runs after all higher-win-rate counting techniques.
- **Output**: `AreaDeduction minStars`
- **Cost**: very expensive

#### Finned Counts (0 wins)
Case analysis on "fin" cells — cells that are the sole exception in a counting argument. Rarely produces deductions in practice. Kept as a deduction contributor.
- **Output**: `AreaDeduction`
- **Benchmark**: 0 wins across 1000 puzzles

---

### Composite / Structural

These build and analyze composite shapes to find forced moves that individual unit analysis cannot see.

#### Composite Shapes (0 direct wins, fuels ~46/1000)
Analyzes unions and intersections of rows and regions. Detects situations where combined placement constraints force specific cells. Never directly wins but contributes to the deduction pool that other techniques then resolve.
- **Output**: `AreaDeduction`
- **Cost**: very expensive (~90960ms total per 1000 puzzles)

#### Squeeze (0 direct wins, fuels ~50/1000)
Identifies intersections of units (row+region, col+region) where spatial constraints reduce valid placements. Contributes intersection-based bounds to the deduction pool.
- **Output**: `AreaDeduction`
- **Cost**: expensive (~43814ms total per 1000 puzzles)

#### Set Differentials (0 wins)
Compares overlapping composite shapes to infer forced moves from star count differences. Intended to handle the "differential argument" from Star Battle theory but currently produces no results. Kept as a future improvement target.
- **Output**: `AreaDeduction`

---

### Shape / Pattern Idiosyncrasies

These handle special regional shapes and spatial patterns that arise in practice.

#### At Sea
Identifies isolated cell sets where stars must be placed due to complete isolation from other regions. When a connected region component is "stranded," placement is forced.
- **Output**: direct `hint`
- **Benchmark**: 9 wins/1000

#### Kissing Ls
When two L-shaped regions share a corner (they "kiss"), the geometric constraints from both needing 2 stars each force specific placements. Hard-coded for the L+L kissing configuration.
- **Output**: direct `hint`
- **Benchmark**: 1 win/1000

#### The M
Handles M-shaped regions (two peaks, one valley). The shape's adjacency constraints combined with the 2-star requirement force the stars to specific cells.
- **Output**: direct `hint`
- **Benchmark**: 1 win/1000

#### Pressured Ts
T-shaped regions under external pressure (surrounding crosses, adjacent stars, 2×2 blocks) have limited valid placements. When the pressure reduces options to a forced outcome, this fires.
- **Output**: direct `hint`
- **Benchmark**: 0 wins across 1000 puzzles

#### Fish (X-Wing / Swordfish)
If N base rows (or columns) have all their valid star positions confined to the same N cover columns (or rows), AND the total remaining stars in the base rows equals the total remaining capacity of the cover columns, the cover columns receive all their remaining stars from the base rows. Any cell in the cover columns outside the base rows must be a cross.

The `totalBaseRemaining === totalCoverRemaining` equality check is essential for correctness when `starsPerUnit > 1`. For `starsPerUnit=1` this always holds automatically; for 2-star puzzles it can fail if base rows are partially satisfied.
- **Output**: direct `hint (place-cross)`
- **Benchmark**: ~18 wins/1000

#### N Rooks
Uses the 2×2 block structure of the 10×10 grid to analyze how blocks in rows and columns constrain placements. Named after the N-rooks problem from combinatorics.
- **Output**: `CellDeduction` or `AreaDeduction`
- **Benchmark**: 11 direct wins/1000, fuels 52 downstream

---

### Schema-Based Logic

#### Schema-Based Logic (109 wins/1000)
A rule-based engine that applies pre-coded logical schemas (patterns of band/region/row relationships) to derive forced moves. Schemas include band budget constraints, exclusive region confinement, and intersection arguments. Each schema is verified against the current puzzle state before a deduction is made.
- **Output**: `AreaDeduction` or direct `hint`
- **Cost**: expensive (checks many schemas)

#### Entanglement Patterns (14 wins/1000)
Uses pre-computed JSON pattern specs that describe geometric relationships between placed stars. Matches the current board against the pattern library and fires when a known entanglement configuration is detected.
- **Output**: direct `hint`
- **Cost**: expensive (pattern matching across board)

---

### Search / Uniqueness

These are last-resort techniques that rely on backtracking search or solution counting. Correct but expensive; only run when all other techniques are exhausted.

#### Entanglement
When multiple units have limited placements with complex interdependencies, analyzes constraint interactions through constrained enumeration. More thorough than Entanglement Patterns but slower.
- **Output**: direct `hint`
- **Cost**: O(n³+), expensive

#### By a Thread (209 wins/1000)
For each empty cell, counts solutions under the "star here" and "cross here" hypotheses. If one hypothesis produces 0 solutions, the other must be true. If one hypothesis produces a unique solution and the other has ≥2, the forced move is the one that leads to the unique solution.

This is essentially a backtracking solver called per cell. It is correct for any solvable puzzle but costs O(cells × backtrack_time). Avg 29495ms wasted by preceding techniques before it wins.
- **Output**: direct `hint (place-star or place-cross)`
- **Benchmark**: 209 wins/1000 (~0.4%)

#### By a Thread at Sea
Combines By a Thread's uniqueness reasoning with At Sea's isolation logic. Tests hypotheses specifically for cells that are candidates for "stranded" placement scenarios.
- **Output**: direct `hint`
- **Benchmark**: 0 direct wins, rarely fires

---

## Deduction Enablers vs. Direct Winners

Some techniques never directly produce a hint but are essential because they feed the deduction pool:

| Technique | Cost | Direct wins | Downstream wins fueled | Notes |
|---|---|---|---|---|
| 2×2 Blocks | ~2s/1000 | 0 | ~38% of all steps | Must run early every step |
| Composite Shapes | ~91s/1000 | 0 | ~46/1000 | Very expensive enabler |
| Squeeze | ~44s/1000 | 0 | ~50/1000 | Expensive enabler |
| N Rooks | ~1s/1000 | 11 | 52 | Both direct and enabler |

The key insight: `accumulatedDeductions` persists across all techniques in a single solver step. When 2×2 Blocks marks 3 cells as `forceEmpty`, and then Exact Fill marks 2 cells as `forceStar`, `analyzeDeductionsWithContext` combines all 5 deductions. If the combination resolves to a hint, Exact Fill gets credit — but 2×2 was the silent prerequisite.

If you move a deduction enabler *after* the technique that consumes its output, the consumer never sees the enabler's deductions in the same step, breaking the chain.

---

## Ordering Summary

```
Basics (cheap, high win rate, deduction seeds)
  Trivial Marks → Locked Row/Col → Saturation → Adjacent Row/Col
  → 2×2 Blocks → Exact Fill → Simple Shapes

Exclusion family (O(n²), medium cost)
  Exclusion → Pressured Exclusion → Adjacent Exclusion
  → Band Block Deficit → Shared Row/Col
  → Cross-Empty Patterns → Cross Pressure → Forced Placement

Case split / enumeration
  Line Case-Split → Region Candidates → Forcing Chains

Counting (ordered by win rate: high → low)
  Overcounting → Partial Overcounting → Locked Outside Footprint
  → Square Counting → Undercounting → Partial Undercounting
  → Finned Counts → Composite Shapes → Squeeze → Set Differentials

Shape idiosyncrasies (rare, specific)
  At Sea → Kissing Ls → The M → Pressured Ts → Fish → N Rooks

Schema / pattern matching
  Schema-Based Logic → Entanglement Patterns

Search / uniqueness (last resort)
  Entanglement → By a Thread → By a Thread at Sea
```

### Why Overcounting before Undercounting?

From 1000-puzzle benchmark:
- Overcounting: **479 wins**, avg 3319ms wasted before winning
- Undercounting: **near-zero wins**, slow
- Partial Undercounting: **24 wins**, avg **16622ms wasted** before winning

Running Partial Undercounting before Overcounting wastes up to 16 seconds on puzzles where Overcounting would have found the answer in ~300ms. The previous order was purely conceptual ("under before over"); the current order is empirical.

### Why 2×2 Blocks runs in Basics, not Counting?

2×2 Blocks emits `CellDeduction forceEmpty` immediately and cheaply (one pass over the board, ~0.25ms). It fuels ~38% of all winning steps. If it ran in the Counting section, every technique before it (exclusion, forced placement, line case-split, etc.) would run without the 2×2 cross information in the pool for that step, potentially missing deductions that depend on it.
