import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  formatRow,
  formatCol,
  formatRegions,
} from '../helpers';
import { canPlaceAllStarsSimultaneously } from '../constraints/placement';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `overcounting-${hintCounter}`;
}

function cellKey(c: Coords): string {
  return `${c.row},${c.col}`;
}

function formatUnitList(indices: number[], formatter: (n: number) => string): string {
  if (indices.length === 0) return '';
  if (indices.length === 1) return formatter(indices[0]);
  if (indices.length === 2) return `${formatter(indices[0])} and ${formatter(indices[1])}`;
  const last = indices[indices.length - 1];
  const rest = indices.slice(0, -1);
  return `${rest.map(formatter).join(', ')}, and ${formatter(last)}`;
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
  const result: Coords[] = [];
  for (const cell of cells) {
    const k = cellKey(cell);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(cell);
    }
  }
  return result;
}

type UnitInfo = {
  cells: Coords[];
  remaining: number;
};

type RegionInfo = {
  id: number;
  cells: Coords[];
  remaining: number;
  // Empty cells that are globally viable star candidates (stronger than just empty)
  candidateEmpties: Coords[];
};

/**
 * OVERCOUNTING (safe version)
 *
 * This implementation only produces crosses that are 100% logically forced by
 * "capacity + confinement" arguments validated with a global star-candidate check.
 *
 * Pattern used (rows version; columns is symmetric):
 * - Choose a set of rows R and a set of regions G with |R| = |G| (small group sizes for performance).
 * - Let cap(R) be the sum of remaining stars in those rows.
 * - Let need(G) be the sum of remaining stars in those regions.
 * - Require cap(R) = need(G) > 0.
 * - Require that every globally viable candidate empty cell belonging to each region in G lies within rows R.
 *   (i.e. the regions' remaining stars are confined to those rows)
 * - Conclusion: all remaining star placements in rows R must belong to regions G.
 *   Therefore, any empty cell in rows R that belongs to a region outside G is forced to be a cross.
 *
 * This is conservative but sound. It avoids relying on heuristics like "max stars in a shape".
 */
export function findOvercountingHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Collect actual region IDs from the grid (do not assume 0/1-based or contiguous).
  const regionIdSet = new Set<number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      regionIdSet.add(state.def.regions[r][c]);
    }
  }
  const regionIds = Array.from(regionIdSet).sort((a, b) => a - b);

  // Cache region cells
  const regionCellsCache = new Map<number, Coords[]>();
  for (const id of regionIds) {
    regionCellsCache.set(id, regionCells(state, id));
  }

  // Star-candidate cache (global viability check)
  const starCandidateCache = new Map<string, boolean>();
  function isStarCandidate(cell: Coords): boolean {
    const k = cellKey(cell);
    const cached = starCandidateCache.get(k);
    if (cached !== undefined) return cached;
    // Must be empty in the current state
    // (We avoid importing getCell here; emptyCells already uses it, but this is explicit.)
    const ok =
      emptyCells(state, [cell]).length === 1 &&
      canPlaceAllStarsSimultaneously(state, [cell], starsPerUnit) !== null;
    starCandidateCache.set(k, ok);
    return ok;
  }

  // Precompute unit infos
  const rowInfos: UnitInfo[] = Array.from({ length: size }, (_, r) => {
    const cells = rowCells(state, r);
    const stars = countStars(state, cells);
    return { cells, remaining: starsPerUnit - stars };
  });

  const colInfos: UnitInfo[] = Array.from({ length: size }, (_, c) => {
    const cells = colCells(state, c);
    const stars = countStars(state, cells);
    return { cells, remaining: starsPerUnit - stars };
  });

  // Precompute region infos
  const regionInfo = new Map<number, RegionInfo>();
  for (const id of regionIds) {
    const cells = regionCellsCache.get(id) ?? [];
    const stars = countStars(state, cells);
    const remaining = starsPerUnit - stars;
    const empties = emptyCells(state, cells);
    const candidateEmpties = empties.filter(isStarCandidate);
    regionInfo.set(id, { id, cells, remaining, candidateEmpties });
  }

  // Helpers for confinement checks
  function confinedToRows(reg: RegionInfo, rowsSet: Set<number>): boolean {
    // Only care about viable candidate empties; if a cell is not globally viable,
    // it cannot host a future star and shouldn't affect confinement.
    for (const e of reg.candidateEmpties) {
      if (!rowsSet.has(e.row)) return false;
    }
    return true;
  }

  function confinedToCols(reg: RegionInfo, colsSet: Set<number>): boolean {
    for (const e of reg.candidateEmpties) {
      if (!colsSet.has(e.col)) return false;
    }
    return true;
  }

  // We try to return the "best" (largest) forced-cross set among all matches.
  let bestHint: { hint: Hint; score: number } | null = null;

  // For performance: most useful patterns are small (2–4). Include 1 to catch trivial confinement.
  const maxGroup = Math.min(4, size, regionIds.length);

  const rowIndices = Array.from({ length: size }, (_, i) => i);
  const colIndices = Array.from({ length: size }, (_, i) => i);

  // --- Rows pattern ---
  for (let groupSize = 1; groupSize <= maxGroup; groupSize += 1) {
    const rowCombos = combinations(rowIndices, groupSize);
    const regionCombos = combinations(regionIds, groupSize);

    for (const rows of rowCombos) {
      const cap = rows.reduce((sum, r) => sum + Math.max(0, rowInfos[r].remaining), 0);
      if (cap <= 0) continue;

      const rowsSet = new Set(rows);

      for (const regs of regionCombos) {
        // Compute need and quick rejects
        let need = 0;
        let ok = true;

        for (const id of regs) {
          const reg = regionInfo.get(id);
          if (!reg) {
            ok = false;
            break;
          }
          if (reg.remaining < 0) {
            ok = false;
            break;
          }
          need += Math.max(0, reg.remaining);
          if (need > cap) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        if (need !== cap || need === 0) continue;

        // Confinement: all viable remaining placements for chosen regions must be within chosen rows
        for (const id of regs) {
          const reg = regionInfo.get(id)!;
          // If a region still needs stars but has zero candidate empties, this pattern cannot conclude anything safely
          if (reg.remaining > 0 && reg.candidateEmpties.length === 0) {
            ok = false;
            break;
          }
          if (!confinedToRows(reg, rowsSet)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        // Cells in those rows belonging to other regions cannot be stars
        const forcedCrosses: Coords[] = [];
        const regsSet = new Set(regs);

        for (const r of rows) {
          for (const cell of rowInfos[r].cells) {
            const cellRegion = state.def.regions[cell.row][cell.col];
            if (!regsSet.has(cellRegion)) {
              // Mark only empty cells (do not return stars/crosses)
              if (emptyCells(state, [cell]).length === 1) {
                forcedCrosses.push(cell);
              }
            }
          }
        }

        if (forcedCrosses.length === 0) continue;

        const explanation =
          `${formatRegions(regs)} can place all their remaining ${need} star(s) ` +
          `only within ${formatUnitList(rows, formatRow)}, and these rows together need exactly ` +
          `${cap} star(s). Therefore, all remaining stars in these rows must belong to those regions, ` +
          `so cells from other regions in these rows must be crosses.`;

        const hint: Hint = {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'overcounting',
          resultCells: forcedCrosses,
          explanation,
          highlights: {
            rows,
            regions: regs,
            cells: uniqueCells(forcedCrosses),
          },
        };

        // Score: prefer more forced crosses; break ties by smaller groupSize (simpler)
        const score = forcedCrosses.length * 1000 - groupSize;
        if (!bestHint || score > bestHint.score) {
          bestHint = { hint, score };
        }
      }
    }
  }

  // --- Columns pattern (symmetric) ---
  for (let groupSize = 1; groupSize <= maxGroup; groupSize += 1) {
    const colCombos = combinations(colIndices, groupSize);
    const regionCombos = combinations(regionIds, groupSize);

    for (const cols of colCombos) {
      const cap = cols.reduce((sum, c) => sum + Math.max(0, colInfos[c].remaining), 0);
      if (cap <= 0) continue;

      const colsSet = new Set(cols);

      for (const regs of regionCombos) {
        let need = 0;
        let ok = true;

        for (const id of regs) {
          const reg = regionInfo.get(id);
          if (!reg) {
            ok = false;
            break;
          }
          if (reg.remaining < 0) {
            ok = false;
            break;
          }
          need += Math.max(0, reg.remaining);
          if (need > cap) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        if (need !== cap || need === 0) continue;

        for (const id of regs) {
          const reg = regionInfo.get(id)!;
          if (reg.remaining > 0 && reg.candidateEmpties.length === 0) {
            ok = false;
            break;
          }
          if (!confinedToCols(reg, colsSet)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        const forcedCrosses: Coords[] = [];
        const regsSet = new Set(regs);

        for (const c of cols) {
          for (const cell of colInfos[c].cells) {
            const cellRegion = state.def.regions[cell.row][cell.col];
            if (!regsSet.has(cellRegion)) {
              if (emptyCells(state, [cell]).length === 1) {
                forcedCrosses.push(cell);
              }
            }
          }
        }

        if (forcedCrosses.length === 0) continue;

        const explanation =
          `${formatRegions(regs)} can place all their remaining ${need} star(s) ` +
          `only within ${formatUnitList(cols, formatCol)}, and these columns together need exactly ` +
          `${cap} star(s). Therefore, all remaining stars in these columns must belong to those regions, ` +
          `so cells from other regions in these columns must be crosses.`;

        const hint: Hint = {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'overcounting',
          resultCells: forcedCrosses,
          explanation,
          highlights: {
            cols,
            regions: regs,
            cells: uniqueCells(forcedCrosses),
          },
        };

        const score = forcedCrosses.length * 1000 - groupSize;
        if (!bestHint || score > bestHint.score) {
          bestHint = { hint, score };
        }
      }
    }
  }

  return bestHint?.hint ?? null;
}

/**
 * TechniqueResult wrapper
 *
 * This safe implementation focuses on producing certain hints (forced crosses).
 * It emits no deductions unless you have a dedicated deduction schema you want to target.
 */
export function findOvercountingResult(state: PuzzleState): TechniqueResult {
  const hint = findOvercountingHint(state);
  if (hint) return { type: 'hint', hint };
  return { type: 'none' };
}
