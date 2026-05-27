import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, AreaDeduction } from '../../types/deductions';
import { regionCells, emptyCells, getCell, idToLetter, formatRow, formatCol } from '../helpers';
import { getPuzzleCache } from '../puzzleCache';
import { getRegionPlacements } from '../regionCandidatesCache';

let hintCounter = 0;
function nextHintId() {
  hintCounter += 1;
  return `forced-placement-${hintCounter}`;
}

/**
 * Forced Placement technique (region-cache-backed):
 *
 * If a region needs stars, and all valid placements include a particular cell,
 * that cell must be a star.
 *
 * We delegate structural enumeration to regionCandidatesCache.
 * getRegionPlacements caches placements per (region, region+halo signature) so
 * the heavy work is shared across techniques and hints. Row/col quota filtering
 * is applied as a post-pass over the cached placement set.
 */

function quotaFilteredPlacements(
  state: PuzzleState,
  regionId: number,
): { placements: Coords[][]; remaining: number } | null {
  const { starsPerUnit } = state.def;
  const rp = getRegionPlacements(state, regionId);
  if (rp === null) return null;
  if (rp.starsNeeded <= 0) return null;
  if (rp.placements.length === 0) return null;
  const cache = getPuzzleCache(state);
  const placements = rp.placements.filter((pl) => {
    const rowAdd = new Map<number, number>();
    const colAdd = new Map<number, number>();
    for (const c of pl) {
      rowAdd.set(c.row, (rowAdd.get(c.row) ?? 0) + 1);
      colAdd.set(c.col, (colAdd.get(c.col) ?? 0) + 1);
    }
    for (const [row, cnt] of rowAdd) {
      if (cache.rowStars[row] + cnt > starsPerUnit) return false;
    }
    for (const [col, cnt] of colAdd) {
      if (cache.colStars[col] + cnt > starsPerUnit) return false;
    }
    return true;
  });
  if (placements.length === 0) return null;
  return { placements, remaining: rp.starsNeeded };
}

export function findForcedPlacementHint(state: PuzzleState): Hint | null {
  const cache = getPuzzleCache(state);
  for (const regionId of cache.regionCellsById.keys()) {
    const data = quotaFilteredPlacements(state, regionId);
    if (!data) continue;
    const { placements } = data;

    // Cells appearing in EVERY placement are forced stars.
    const inclusion = new Map<string, { cell: Coords; count: number }>();
    for (const pl of placements) {
      for (const c of pl) {
        const k = `${c.row},${c.col}`;
        const e = inclusion.get(k);
        if (e) e.count += 1;
        else inclusion.set(k, { cell: c, count: 1 });
      }
    }
    const total = placements.length;
    const forcedCells: Coords[] = [];
    for (const { cell, count } of inclusion.values()) {
      if (count === total && getCell(state, cell) === 'empty') forcedCells.push(cell);
    }
    if (forcedCells.length === 0) continue;
    const remaining = data.remaining;
    return {
      id: nextHintId(),
      kind: 'place-star',
      technique: 'forced-placement',
      resultCells: forcedCells,
      explanation: `Region ${idToLetter(regionId)} needs ${remaining} star(s). All possible valid placements for these stars include ${forcedCells.length === 1 ? 'this cell' : 'these cells'}, so ${forcedCells.length === 1 ? 'it' : 'they'} must be ${forcedCells.length === 1 ? 'a star' : 'stars'}.`,
      highlights: { regions: [regionId], cells: forcedCells },
    };
  }
  return null;
}

/**
 * Project placements onto rows and columns:
 *   row r must hold ≥ minInRow stars among (region ∩ row r) candidate cells.
 *
 * Feeds the main solver's line-saturation resolver to force crosses elsewhere
 * in those lines.
 */
function buildProjectionDeductions(
  state: PuzzleState,
  regionId: number,
  placementSets: Coords[][],
  candidateCells: Coords[],
): AreaDeduction[] {
  if (placementSets.length === 0) return [];
  const out: AreaDeduction[] = [];

  const rowsTouched = new Set<number>();
  const colsTouched = new Set<number>();
  for (const c of candidateCells) {
    rowsTouched.add(c.row);
    colsTouched.add(c.col);
  }

  for (const row of rowsTouched) {
    let minInRow = Infinity;
    for (const placement of placementSets) {
      const count = placement.reduce((acc, p) => acc + (p.row === row ? 1 : 0), 0);
      if (count < minInRow) minInRow = count;
    }
    if (minInRow < 1) continue;

    const rowCands = candidateCells.filter((c) => c.row === row);
    const fullRowEmpties = emptyCells(
      state,
      Array.from({ length: state.def.size }, (_, col) => ({ row, col })),
    );
    if (rowCands.length === fullRowEmpties.length) continue;
    if (rowCands.length === 0) continue;

    out.push({
      kind: 'area',
      technique: 'forced-placement',
      areaType: 'row',
      areaId: row,
      candidateCells: rowCands,
      minStars: minInRow,
      explanation: `Every valid placement of region ${idToLetter(regionId)}'s stars puts at least ${minInRow} star(s) in ${formatRow(row)}, all within ${rowCands.length} candidate cell(s).`,
    });
  }

  for (const col of colsTouched) {
    let minInCol = Infinity;
    for (const placement of placementSets) {
      const count = placement.reduce((acc, p) => acc + (p.col === col ? 1 : 0), 0);
      if (count < minInCol) minInCol = count;
    }
    if (minInCol < 1) continue;

    const colCands = candidateCells.filter((c) => c.col === col);
    const fullColEmpties = emptyCells(
      state,
      Array.from({ length: state.def.size }, (_, row) => ({ row, col })),
    );
    if (colCands.length === fullColEmpties.length) continue;
    if (colCands.length === 0) continue;

    out.push({
      kind: 'area',
      technique: 'forced-placement',
      areaType: 'column',
      areaId: col,
      candidateCells: colCands,
      minStars: minInCol,
      explanation: `Every valid placement of region ${idToLetter(regionId)}'s stars puts at least ${minInCol} star(s) in ${formatCol(col)}, all within ${colCands.length} candidate cell(s).`,
    });
  }

  return out;
}

/**
 * The candidate cells used for projection are the union of cells appearing in
 * any quota-respecting placement — i.e. cells that COULD host a star.
 */
function unionCandidatesFromPlacements(placements: Coords[][]): Coords[] {
  const seen = new Set<string>();
  const out: Coords[] = [];
  for (const pl of placements) {
    for (const c of pl) {
      const k = `${c.row},${c.col}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(c);
      }
    }
  }
  return out;
}

export function findForcedPlacementResult(state: PuzzleState): TechniqueResult {
  const deductions: Deduction[] = [];
  const cache = getPuzzleCache(state);

  for (const regionId of cache.regionCellsById.keys()) {
    const data = quotaFilteredPlacements(state, regionId);
    if (!data) continue;
    const { placements, remaining } = data;

    const region = regionCells(state, regionId);
    const empties = emptyCells(state, region);
    const candidateCells = unionCandidatesFromPlacements(placements);

    // Region-level candidate restriction.
    if (candidateCells.length < empties.length && candidateCells.length >= remaining) {
      deductions.push({
        kind: 'area',
        technique: 'forced-placement',
        areaType: 'region',
        areaId: regionId,
        candidateCells,
        minStars: remaining,
        explanation: `Region ${idToLetter(regionId)} needs ${remaining} star(s), and only ${candidateCells.length} candidate cell(s) remain after filtering invalid placements.`,
      });
    }

    deductions.push(...buildProjectionDeductions(state, regionId, placements, candidateCells));
  }

  const hint = findForcedPlacementHint(state);
  if (hint) {
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }
  if (deductions.length > 0) return { type: 'deductions', deductions };
  return { type: 'none' };
}
