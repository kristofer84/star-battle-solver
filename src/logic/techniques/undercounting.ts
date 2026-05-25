import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  intersection,
  union,
  difference,
  getCell,
  formatRow,
  formatCol,
  formatRegions,
} from '../helpers';
import { canPlaceAllStarsSimultaneously } from '../constraints/placement';
import { countSolutions } from '../search';

let hintCounter = 0;
function nextHintId() {
  hintCounter += 1;
  return `undercounting-${hintCounter}`;
}

function cellKey(c: Coords): string {
  return `${c.row},${c.col}`;
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > items.length) return [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, k - 1).map((combo) => [first, ...combo]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function uniqueCells(cells: Coords[]): Coords[] {
  const seen = new Set<string>();
  const out: Coords[] = [];
  for (const c of cells) {
    const k = cellKey(c);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

function formatUnitList(indices: number[], formatter: (n: number) => string): string {
  if (indices.length === 0) return '';
  if (indices.length === 1) return formatter(indices[0]);
  if (indices.length === 2) return `${formatter(indices[0])} and ${formatter(indices[1])}`;
  const last = indices[indices.length - 1];
  const rest = indices.slice(0, -1);
  return `${rest.map(formatter).join(', ')}, and ${formatter(last)}`;
}

function cloneState(state: PuzzleState): PuzzleState {
  return {
    def: state.def,
    cells: state.cells.map((row) => [...row]),
  };
}

/**
 * Maximum stars that can be simultaneously placed from a set of candidate cells.
 * Mirrors the same helper in overcounting.ts — needed here to tighten outside caps.
 */
function maxPackableStars(
  cells: Coords[],
  limit: number,
  state: PuzzleState,
  starsPerUnit: number,
): number {
  const maxK = Math.min(limit, cells.length);
  if (maxK === 0) return 0;
  if (cells.length > 8) return limit; // conservative fallback for large sets
  for (let k = maxK; k >= 1; k -= 1) {
    for (const subset of combinations(cells, k)) {
      if (canPlaceAllStarsSimultaneously(state, subset, starsPerUnit) !== null) {
        return k;
      }
    }
  }
  return 0;
}

/**
 * 100% safe forced-star verifier:
 * A cell is forced to be a star iff setting it to a cross yields 0 solutions.
 * If the solver times out, we treat it as "not proven" and do not emit a hint.
 */
function isForcedStarBySearch(
  state: PuzzleState,
  cell: Coords,
  opts?: { timeoutMs?: number; maxDepth?: number },
): boolean {
  const hyp = cloneState(state);
  hyp.cells[cell.row][cell.col] = 'cross';

  const sol = countSolutions(hyp, {
    maxCount: 1,
    timeoutMs: opts?.timeoutMs ?? 1500,
    maxDepth: opts?.maxDepth ?? 250,
  });

  if (sol.timedOut) return false;
  return sol.count === 0;
}

export function findUndercountingHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Collect actual region IDs from the grid (do not assume contiguous / 0-based / 1-based).
  const regionIdSet = new Set<number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      regionIdSet.add(state.def.regions[r][c]);
    }
  }
  const regionIds = Array.from(regionIdSet).sort((a, b) => a - b);

  // Caches
  const regionCellsCache = new Map<number, Coords[]>();
  for (const id of regionIds) {
    regionCellsCache.set(id, regionCells(state, id));
  }

  const starCandidateCache = new Map<string, boolean>();
  function isStarCandidate(cell: Coords): boolean {
    const k = cellKey(cell);
    const cached = starCandidateCache.get(k);
    if (cached !== undefined) return cached;
    if (getCell(state, cell) !== 'empty') {
      starCandidateCache.set(k, false);
      return false;
    }
    const ok = canPlaceAllStarsSimultaneously(state, [cell], starsPerUnit) !== null;
    starCandidateCache.set(k, ok);
    return ok;
  }

  function candidateEmpties(cells: Coords[]): Coords[] {
    return emptyCells(state, cells).filter(isStarCandidate);
  }

  // Precompute row/col remaining
  const rowInfo = Array.from({ length: size }, (_, r) => {
    const cells = rowCells(state, r);
    const stars = countStars(state, cells);
    return { cells, remaining: starsPerUnit - stars };
  });

  const colInfo = Array.from({ length: size }, (_, c) => {
    const cells = colCells(state, c);
    const stars = countStars(state, cells);
    return { cells, remaining: starsPerUnit - stars };
  });

  const regionInfo = new Map<number, { cells: Coords[]; remaining: number }>();
  for (const id of regionIds) {
    const cells = regionCellsCache.get(id) ?? [];
    const stars = countStars(state, cells);
    regionInfo.set(id, { cells, remaining: starsPerUnit - stars });
  }

  // Candidate list (we verify with search before returning)
  type Candidate = {
    kind: 'row-region' | 'col-region' | 'row-multiregion' | 'col-multiregion';
    forced: Coords[];
    rows?: number[];
    cols?: number[];
    regions: number[];
    explanation: string;
  };

  const candidates: Candidate[] = [];

  // Helper to add a forced-star candidate (counting-based, then verified by search)
  function addCandidate(candidate: Candidate) {
    const forcedUnique = uniqueCells(candidate.forced).filter((c) => getCell(state, c) === 'empty');
    if (forcedUnique.length === 0) return;

    // Avoid huge multi-cell proofs; stay conservative.
    if (forcedUnique.length > 6) return;

    // Quick feasibility: placing all these stars must be globally consistent (local+unit checks)
    if (canPlaceAllStarsSimultaneously(state, forcedUnique, starsPerUnit) === null) return;

    // Proof: each forced star must be individually forced by search.
    for (const c of forcedUnique) {
      if (!isForcedStarBySearch(state, c)) return;
    }

    candidates.push({ ...candidate, forced: forcedUnique });
  }

  // --- Pattern 1: row ∩ region ---
  for (let r = 0; r < size; r += 1) {
    const rowRemaining = rowInfo[r].remaining;
    if (rowRemaining <= 0) continue;

    const rowNonCross = rowInfo[r].cells.filter((c) => getCell(state, c) !== 'cross');

    for (const regionId of regionIds) {
      const reg = regionInfo.get(regionId);
      if (!reg) continue;
      const regionRemaining = reg.remaining;
      if (regionRemaining <= 0) continue;

      const regionNonCross = reg.cells.filter((c) => getCell(state, c) !== 'cross');
      const shape = intersection(rowNonCross, regionNonCross);
      if (shape.length === 0) continue;

      const inShape = candidateEmpties(shape);
      if (inShape.length === 0) continue;

      const rowOutside = difference(rowNonCross, shape);
      const regionOutside = difference(regionNonCross, shape);

      const rowOutsideCap = maxPackableStars(candidateEmpties(rowOutside), rowRemaining, state, starsPerUnit);
      const regionOutsideCap = maxPackableStars(candidateEmpties(regionOutside), regionRemaining, state, starsPerUnit);

      const minStarsInIntersection = Math.max(
        0,
        rowRemaining - rowOutsideCap,
        regionRemaining - regionOutsideCap,
      );

      if (minStarsInIntersection === inShape.length) {
        addCandidate({
          kind: 'row-region',
          forced: inShape,
          rows: [r],
          regions: [regionId],
          explanation:
            `${formatRow(r)} needs ${rowRemaining} more star(s) and ${formatRegions([regionId])} needs ` +
            `${regionRemaining} more star(s). Outside their intersection, at most ` +
            `${rowOutsideCap} star(s) can be placed in the row and ${regionOutsideCap} in the region ` +
            `(accounting for adjacency constraints), so the intersection must contain ${inShape.length} star(s). ` +
            `Therefore all ${inShape.length} cell(s) are stars.`,
        });
      }
    }
  }

  // --- Pattern 2: col ∩ region ---
  for (let c = 0; c < size; c += 1) {
    const colRemaining = colInfo[c].remaining;
    if (colRemaining <= 0) continue;

    const colNonCross = colInfo[c].cells.filter((cell) => getCell(state, cell) !== 'cross');

    for (const regionId of regionIds) {
      const reg = regionInfo.get(regionId);
      if (!reg) continue;
      const regionRemaining = reg.remaining;
      if (regionRemaining <= 0) continue;

      const regionNonCross = reg.cells.filter((cell) => getCell(state, cell) !== 'cross');
      const shape = intersection(colNonCross, regionNonCross);
      if (shape.length === 0) continue;

      const inShape = candidateEmpties(shape);
      if (inShape.length === 0) continue;

      const colOutside = difference(colNonCross, shape);
      const regionOutside = difference(regionNonCross, shape);

      const colOutsideCap = maxPackableStars(candidateEmpties(colOutside), colRemaining, state, starsPerUnit);
      const regionOutsideCap = maxPackableStars(candidateEmpties(regionOutside), regionRemaining, state, starsPerUnit);

      const minStarsInIntersection = Math.max(
        0,
        colRemaining - colOutsideCap,
        regionRemaining - regionOutsideCap,
      );

      if (minStarsInIntersection === inShape.length) {
        addCandidate({
          kind: 'col-region',
          forced: inShape,
          cols: [c],
          regions: [regionId],
          explanation:
            `${formatCol(c)} needs ${colRemaining} more star(s) and ${formatRegions([regionId])} needs ` +
            `${regionRemaining} more star(s). Outside their intersection, at most ` +
            `${colOutsideCap} star(s) can be placed in the column and ${regionOutsideCap} in the region ` +
            `(accounting for adjacency constraints), so the intersection must contain ${inShape.length} star(s). ` +
            `Therefore all ${inShape.length} cell(s) are stars.`,
        });
      }
    }
  }

  // --- Pattern 3: row ∩ union(regions) (small region groups) ---
  const maxRegGroup = Math.min(3, regionIds.length);
  for (let r = 0; r < size; r += 1) {
    const rowRemaining = rowInfo[r].remaining;
    if (rowRemaining <= 0) continue;

    const rowNonCross = rowInfo[r].cells.filter((c) => getCell(state, c) !== 'cross');

    for (let k = 2; k <= maxRegGroup; k += 1) {
      for (const regs of combinations(regionIds, k)) {
        // remaining stars needed by union of regions (conservative: sum of remainings)
        let unionRemaining = 0;
        let unionCells: Coords[] = [];
        let ok = true;

        for (const id of regs) {
          const reg = regionInfo.get(id);
          if (!reg) {
            ok = false;
            break;
          }
          if (reg.remaining <= 0) {
            ok = false;
            break;
          }
          unionRemaining += reg.remaining;
          const nonCross = reg.cells.filter((c) => getCell(state, c) !== 'cross');
          unionCells = union(unionCells, nonCross);
        }
        if (!ok) continue;

        const shape = intersection(rowNonCross, unionCells);
        if (shape.length === 0) continue;

        const inShape = candidateEmpties(shape);
        if (inShape.length === 0) continue;

        const rowOutside = difference(rowNonCross, shape);
        const unionOutside = difference(unionCells, shape);

        const rowOutsideCap = maxPackableStars(candidateEmpties(rowOutside), rowRemaining, state, starsPerUnit);
        const unionOutsideCap = maxPackableStars(candidateEmpties(unionOutside), unionRemaining, state, starsPerUnit);

        const minStarsInIntersection = Math.max(
          0,
          rowRemaining - rowOutsideCap,
          unionRemaining - unionOutsideCap,
        );

        if (minStarsInIntersection === inShape.length) {
          addCandidate({
            kind: 'row-multiregion',
            forced: inShape,
            rows: [r],
            regions: regs,
            explanation:
              `${formatRow(r)} needs ${rowRemaining} more star(s) and ${formatRegions(regs)} together need ` +
              `at least ${unionRemaining} more star(s). Outside their intersection, at most ` +
              `${rowOutsideCap} star(s) can be placed in the row and ${unionOutsideCap} in those regions ` +
              `(accounting for adjacency constraints), so the intersection must contain ${inShape.length} star(s). ` +
              `Therefore all ${inShape.length} cell(s) are stars.`,
          });
        }
      }
    }
  }

  // --- Pattern 4: col ∩ union(regions) (small region groups) ---
  for (let c = 0; c < size; c += 1) {
    const colRemaining = colInfo[c].remaining;
    if (colRemaining <= 0) continue;

    const colNonCross = colInfo[c].cells.filter((cell) => getCell(state, cell) !== 'cross');

    for (let k = 2; k <= maxRegGroup; k += 1) {
      for (const regs of combinations(regionIds, k)) {
        let unionRemaining = 0;
        let unionCells: Coords[] = [];
        let ok = true;

        for (const id of regs) {
          const reg = regionInfo.get(id);
          if (!reg) {
            ok = false;
            break;
          }
          if (reg.remaining <= 0) {
            ok = false;
            break;
          }
          unionRemaining += reg.remaining;
          const nonCross = reg.cells.filter((cell) => getCell(state, cell) !== 'cross');
          unionCells = union(unionCells, nonCross);
        }
        if (!ok) continue;

        const shape = intersection(colNonCross, unionCells);
        if (shape.length === 0) continue;

        const inShape = candidateEmpties(shape);
        if (inShape.length === 0) continue;

        const colOutside = difference(colNonCross, shape);
        const unionOutside = difference(unionCells, shape);

        const colOutsideCap = maxPackableStars(candidateEmpties(colOutside), colRemaining, state, starsPerUnit);
        const unionOutsideCap = maxPackableStars(candidateEmpties(unionOutside), unionRemaining, state, starsPerUnit);

        const minStarsInIntersection = Math.max(
          0,
          colRemaining - colOutsideCap,
          unionRemaining - unionOutsideCap,
        );

        if (minStarsInIntersection === inShape.length) {
          addCandidate({
            kind: 'col-multiregion',
            forced: inShape,
            cols: [c],
            regions: regs,
            explanation:
              `${formatCol(c)} needs ${colRemaining} more star(s) and ${formatRegions(regs)} together need ` +
              `at least ${unionRemaining} more star(s). Outside their intersection, at most ` +
              `${colOutsideCap} star(s) can be placed in the column and ${unionOutsideCap} in those regions ` +
              `(accounting for adjacency constraints), so the intersection must contain ${inShape.length} star(s). ` +
              `Therefore all ${inShape.length} cell(s) are stars.`,
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Choose the best candidate: more forced stars first, then simpler pattern.
  candidates.sort((a, b) => {
    if (b.forced.length !== a.forced.length) return b.forced.length - a.forced.length;
    return a.regions.length - b.regions.length;
  });

  const best = candidates[0];
  const hint: Hint = {
    id: nextHintId(),
    kind: 'place-star',
    technique: 'undercounting',
    resultCells: best.forced,
    explanation: best.explanation,
    highlights: {
      rows: best.rows,
      cols: best.cols,
      regions: best.regions,
      cells: best.forced,
    },
  };

  return hint;
}

export function findUndercountingResult(state: PuzzleState): TechniqueResult {
  const hint = findUndercountingHint(state);
  if (hint) return { type: 'hint', hint };
  return { type: 'none' };
}

/**
 * PARTIAL UNDERCOUNTING
 *
 * Symmetric dual of partial overcounting. For a band of K rows (or cols):
 *   minInBand(R) = max(0, R.remaining − maxPackableOutside(R, band))
 *
 * When Σ minInBand == cap (band exactly saturated by mandatory contributions):
 *   For any region R where insideCandidates(R).length == minInBand(R) > 0,
 *   all inside candidates are forced stars.
 *
 * Soundness: computed maxOut ≥ actual maxOut → computed minIn ≤ actual minIn.
 * When Σ computed minIn = cap and actual Σ ≤ cap, each computed minIn equals
 * the actual minIn. If insideCandidates.length == minIn, all must be stars.
 */
export function findPartialUndercountingHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  const regionIdSet = new Set<number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      regionIdSet.add(state.def.regions[r][c]);
    }
  }
  const regionIds = Array.from(regionIdSet).sort((a, b) => a - b);

  const starCandidateCache = new Map<string, boolean>();
  function isStarCandidate(cell: Coords): boolean {
    const k = cellKey(cell);
    const cached = starCandidateCache.get(k);
    if (cached !== undefined) return cached;
    const ok =
      getCell(state, cell) === 'empty' &&
      canPlaceAllStarsSimultaneously(state, [cell], starsPerUnit) !== null;
    starCandidateCache.set(k, ok);
    return ok;
  }

  const rowInfos = Array.from({ length: size }, (_, r) => {
    const cells = rowCells(state, r);
    const stars = countStars(state, cells);
    return { remaining: starsPerUnit - stars };
  });

  const colInfos = Array.from({ length: size }, (_, c) => {
    const cells = colCells(state, c);
    const stars = countStars(state, cells);
    return { remaining: starsPerUnit - stars };
  });

  interface RegInfo {
    id: number;
    remaining: number;
    candidateEmpties: Coords[];
  }

  const regionInfoMap = new Map<number, RegInfo>();
  for (const id of regionIds) {
    const cells = regionCells(state, id);
    const stars = countStars(state, cells);
    const remaining = starsPerUnit - stars;
    const candidates = emptyCells(state, cells).filter(isStarCandidate);
    regionInfoMap.set(id, { id, remaining, candidateEmpties: candidates });
  }

  let bestHint: { hint: Hint; score: number } | null = null;

  function tryBand(bandIndices: number[], cap: number, bandSet: Set<number>, isRow: boolean) {
    if (cap <= 0) return;

    let totalMin = 0;
    const minInBandMap = new Map<number, number>();

    for (const id of regionIds) {
      const reg = regionInfoMap.get(id)!;
      if (reg.remaining <= 0) {
        minInBandMap.set(id, 0);
        continue;
      }
      const outsideCandidates = reg.candidateEmpties.filter(
        (c) => !(isRow ? bandSet.has(c.row) : bandSet.has(c.col)),
      );
      const maxOut = maxPackableStars(outsideCandidates, reg.remaining, state, starsPerUnit);
      const minIn = Math.max(0, reg.remaining - maxOut);
      minInBandMap.set(id, minIn);
      totalMin += minIn;
      if (totalMin > cap) return;
    }

    if (totalMin !== cap) return;

    const forcedStars: Coords[] = [];
    const tightRegions: number[] = [];
    const contributingRegions: number[] = [];

    for (const id of regionIds) {
      const minIn = minInBandMap.get(id) ?? 0;
      if (minIn <= 0) continue;
      contributingRegions.push(id);
      const reg = regionInfoMap.get(id)!;
      const insideCandidates = reg.candidateEmpties.filter(
        (c) => isRow ? bandSet.has(c.row) : bandSet.has(c.col),
      );
      if (insideCandidates.length !== minIn) continue;
      // Feasibility: all inside candidates must be placeable simultaneously
      if (canPlaceAllStarsSimultaneously(state, insideCandidates, starsPerUnit) === null) continue;
      for (const c of insideCandidates) forcedStars.push(c);
      tightRegions.push(id);
    }

    if (forcedStars.length === 0) return;

    const bandLabel = isRow
      ? formatUnitList(bandIndices, formatRow)
      : formatUnitList(bandIndices, formatCol);

    const partialNotes = contributingRegions
      .map((id) => {
        const reg = regionInfoMap.get(id)!;
        const minIn = minInBandMap.get(id) ?? 0;
        const maxOut = reg.remaining - minIn;
        if (minIn === reg.remaining) {
          return `${formatRegions([id])} is fully confined to ${bandLabel} (${reg.remaining} star(s))`;
        }
        return (
          `${formatRegions([id])} needs ${reg.remaining} star(s) but can place at most ${maxOut} ` +
          `outside ${bandLabel}, so at least ${minIn} must be inside`
        );
      })
      .join('; ');

    const explanation =
      `${bandLabel} need${bandIndices.length > 1 ? '' : 's'} ${cap} star(s). ` +
      (partialNotes ? `${partialNotes}. ` : '') +
      `Mandatory contributions sum to exactly ${cap}, leaving no slack. ` +
      `${formatRegions(tightRegions)} ${tightRegions.length > 1 ? 'have' : 'has'} exactly as many ` +
      `inside candidates as required — all are forced stars.`;

    const hint: Hint = {
      id: nextHintId(),
      kind: 'place-star',
      technique: 'partial-undercounting',
      resultCells: uniqueCells(forcedStars),
      explanation,
      highlights: {
        ...(isRow ? { rows: bandIndices } : { cols: bandIndices }),
        regions: contributingRegions,
        cells: uniqueCells(forcedStars),
      },
    };

    const score = forcedStars.length * 1000 - bandIndices.length;
    if (!bestHint || score > bestHint.score) {
      bestHint = { hint, score };
    }
  }

  const maxBandSize = Math.min(4, size);
  const rowIndices = Array.from({ length: size }, (_, i) => i);
  const colIndices = Array.from({ length: size }, (_, i) => i);

  for (let bandSize = 1; bandSize <= maxBandSize; bandSize += 1) {
    for (const combo of combinations(rowIndices, bandSize)) {
      const cap = combo.reduce((s, r) => s + Math.max(0, rowInfos[r].remaining), 0);
      tryBand(combo, cap, new Set(combo), true);
    }
    for (const combo of combinations(colIndices, bandSize)) {
      const cap = combo.reduce((s, c) => s + Math.max(0, colInfos[c].remaining), 0);
      tryBand(combo, cap, new Set(combo), false);
    }
  }

  return (bestHint as { hint: Hint; score: number } | null)?.hint ?? null;
}

export function findPartialUndercountingResult(state: PuzzleState): TechniqueResult {
  const hint = findPartialUndercountingHint(state);
  if (hint) return { type: 'hint', hint };
  return { type: 'none' };
}
