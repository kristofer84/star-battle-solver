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

      const rowOutsideCap = candidateEmpties(rowOutside).length;
      const regionOutsideCap = candidateEmpties(regionOutside).length;

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
            `${regionRemaining} more star(s). Outside their intersection there are only ` +
            `${rowOutsideCap} star-slot(s) in the row and ${regionOutsideCap} star-slot(s) in the region, ` +
            `so the intersection must contain ${inShape.length} star(s). Therefore all ${inShape.length} cell(s) are stars.`,
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

      const colOutsideCap = candidateEmpties(colOutside).length;
      const regionOutsideCap = candidateEmpties(regionOutside).length;

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
            `${regionRemaining} more star(s). Outside their intersection there are only ` +
            `${colOutsideCap} star-slot(s) in the column and ${regionOutsideCap} star-slot(s) in the region, ` +
            `so the intersection must contain ${inShape.length} star(s). Therefore all ${inShape.length} cell(s) are stars.`,
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

        const rowOutsideCap = candidateEmpties(rowOutside).length;
        const unionOutsideCap = candidateEmpties(unionOutside).length;

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
              `at least ${unionRemaining} more star(s). Outside their intersection there are only ` +
              `${rowOutsideCap} star-slot(s) in the row and ${unionOutsideCap} star-slot(s) in those regions, ` +
              `so the intersection must contain ${inShape.length} star(s). Therefore all ${inShape.length} cell(s) are stars.`,
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

        const colOutsideCap = candidateEmpties(colOutside).length;
        const unionOutsideCap = candidateEmpties(unionOutside).length;

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
              `at least ${unionRemaining} more star(s). Outside their intersection there are only ` +
              `${colOutsideCap} star-slot(s) in the column and ${unionOutsideCap} star-slot(s) in those regions, ` +
              `so the intersection must contain ${inShape.length} star(s). Therefore all ${inShape.length} cell(s) are stars.`,
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
