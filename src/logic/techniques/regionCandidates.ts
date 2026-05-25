import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, CellDeduction } from '../../types/deductions';
import { regionCells, countStars, neighbors8, idToLetter } from '../helpers';

/**
 * Region Candidate Enumeration:
 *
 * For each region, enumerate all valid placements of the region's remaining stars.
 * A placement is valid if:
 *   - All cells are empty and not adjacent to existing stars
 *   - No two cells are 8-adjacent to each other
 *   - No row/col receives more stars than it still needs
 *
 * If a candidate cell appears in 0 valid placements → must be cross.
 * If a candidate cell appears in ALL valid placements → must be star.
 */
export function findRegionCandidatesHint(_state: PuzzleState): Hint | null {
  return null;
}

export function findRegionCandidatesResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit, regions } = state.def;
  const deductions: CellDeduction[] = [];

  const rowStars = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (state.cells[r][c] === 'star') {
        rowStars[r]++;
        colStars[c]++;
      }
    }
  }

  const regionIds = new Set<number>();
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      regionIds.add(regions[r][c]);

  for (const regionId of regionIds) {
    const allCells = regionCells(state, regionId);
    const regionStarCount = countStars(state, allCells);
    const remaining = starsPerUnit - regionStarCount;

    if (remaining <= 0) continue;

    // Valid candidate cells: empty, row/col not full, not adjacent to existing star
    const candidates: Coords[] = [];
    for (const cell of allCells) {
      if (state.cells[cell.row][cell.col] !== 'empty') continue;
      if (rowStars[cell.row] >= starsPerUnit) continue;
      if (colStars[cell.col] >= starsPerUnit) continue;
      let adjStar = false;
      for (const nb of neighbors8(cell, size)) {
        if (state.cells[nb.row][nb.col] === 'star') { adjStar = true; break; }
      }
      if (adjStar) continue;
      candidates.push(cell);
    }

    if (candidates.length < remaining) continue;
    // Cap enumeration to avoid exponential blow-up
    if (candidates.length > 22) continue;

    const inclusionCount = new Array(candidates.length).fill(0);
    let totalValid = 0;

    function enumerate(start: number, chosen: number[]): void {
      if (chosen.length === remaining) {
        // Verify row/col quotas
        const rowUse = new Map<number, number>();
        const colUse = new Map<number, number>();
        for (const idx of chosen) {
          const cell = candidates[idx];
          rowUse.set(cell.row, (rowUse.get(cell.row) ?? 0) + 1);
          colUse.set(cell.col, (colUse.get(cell.col) ?? 0) + 1);
        }
        for (const [row, cnt] of rowUse) {
          if (rowStars[row] + cnt > starsPerUnit) return;
        }
        for (const [col, cnt] of colUse) {
          if (colStars[col] + cnt > starsPerUnit) return;
        }
        totalValid++;
        for (const idx of chosen) inclusionCount[idx]++;
        return;
      }

      const needed = remaining - chosen.length;
      for (let i = start; i <= candidates.length - needed; i++) {
        const cell = candidates[i];
        // Must not be 8-adjacent to any already chosen cell
        let adj = false;
        for (const idx of chosen) {
          const other = candidates[idx];
          if (Math.abs(cell.row - other.row) <= 1 && Math.abs(cell.col - other.col) <= 1) {
            adj = true;
            break;
          }
        }
        if (adj) continue;
        chosen.push(i);
        enumerate(i + 1, chosen);
        chosen.pop();
      }
    }

    enumerate(0, []);

    if (totalValid === 0) continue;

    const label = idToLetter(regionId);
    for (let i = 0; i < candidates.length; i++) {
      const cell = candidates[i];
      if (inclusionCount[i] === 0) {
        deductions.push({
          kind: 'cell',
          type: 'forceEmpty',
          cell,
          technique: 'region-candidates',
          explanation: `Region ${label}: (${cell.row},${cell.col}) appears in none of the ${totalValid} valid star placements.`,
        });
      } else if (inclusionCount[i] === totalValid) {
        deductions.push({
          kind: 'cell',
          type: 'forceStar',
          cell,
          technique: 'region-candidates',
          explanation: `Region ${label}: (${cell.row},${cell.col}) appears in all ${totalValid} valid star placements.`,
        });
      }
    }
  }

  if (deductions.length > 0) return { type: 'deductions', deductions };
  return { type: 'none' };
}
