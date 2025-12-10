import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, AreaDeduction } from '../../types/deductions';
import { rowCells, colCells, regionCells, emptyCells, countStars, formatRow, formatCol, formatRegion } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `saturation-${hintCounter}`;
}

/**
 * Saturation:
 *
 * If all stars are already placed in a row/column/region (star count equals starsPerUnit),
 * then all remaining empty cells in that area must be crosses.
 *
 * This is a straightforward consequence: once an area has reached its star quota,
 * no more stars can be placed there, so remaining cells must be crosses.
 */
export function findSaturationHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Rows
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const starCount = countStars(state, row);
    if (starCount === starsPerUnit) {
      const empties = emptyCells(state, row);
      if (empties.length > 0) {
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'saturation',
          resultCells: empties,
          explanation: `${formatRow(r)} already has all ${starsPerUnit} star(s), so all remaining empty cells must be crosses.`,
          highlights: { rows: [r], cells: empties },
        };
      }
    }
  }

  // Columns
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const starCount = countStars(state, col);
    if (starCount === starsPerUnit) {
      const empties = emptyCells(state, col);
      if (empties.length > 0) {
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'saturation',
          resultCells: empties,
          explanation: `${formatCol(c)} already has all ${starsPerUnit} star(s), so all remaining empty cells must be crosses.`,
          highlights: { cols: [c], cells: empties },
        };
      }
    }
  }

  // Regions
  for (let regionId = 0; regionId <= 9; regionId += 1) {
    const region = regionCells(state, regionId);
    if (!region.length) continue;
    const starCount = countStars(state, region);
    if (starCount === starsPerUnit) {
      const empties = emptyCells(state, region);
      if (empties.length > 0) {
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'saturation',
          resultCells: empties,
          explanation: `Region ${formatRegion(regionId)} already has all ${starsPerUnit} star(s), so all remaining empty cells must be crosses.`,
          highlights: { regions: [regionId], cells: empties },
        };
      }
    }
  }

  return null;
}

/**
 * Find result with deductions support
 */
export function findSaturationResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit } = state.def;
  const deductions: Deduction[] = [];

  // Check rows, columns, and regions for saturation
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const starCount = countStars(state, row);
    if (starCount === starsPerUnit) {
      const empties = emptyCells(state, row);
      if (empties.length > 0) {
        deductions.push({
          kind: 'area',
          technique: 'saturation',
          areaType: 'row',
          areaId: r,
          candidateCells: empties,
          maxStars: 0,
          explanation: `${formatRow(r)} already has all ${starsPerUnit} star(s), so remaining cells must be crosses.`,
        });
      }
    }
  }

  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const starCount = countStars(state, col);
    if (starCount === starsPerUnit) {
      const empties = emptyCells(state, col);
      if (empties.length > 0) {
        deductions.push({
          kind: 'area',
          technique: 'saturation',
          areaType: 'column',
          areaId: c,
          candidateCells: empties,
          maxStars: 0,
          explanation: `${formatCol(c)} already has all ${starsPerUnit} star(s), so remaining cells must be crosses.`,
        });
      }
    }
  }

  for (let regionId = 1; regionId <= 10; regionId += 1) {
    const region = regionCells(state, regionId);
    if (!region.length) continue;
    const starCount = countStars(state, region);
    if (starCount === starsPerUnit) {
      const empties = emptyCells(state, region);
      if (empties.length > 0) {
        deductions.push({
          kind: 'area',
          technique: 'saturation',
          areaType: 'region',
          areaId: regionId,
          candidateCells: empties,
          maxStars: 0,
          explanation: `Region ${formatRegion(regionId)} already has all ${starsPerUnit} star(s), so remaining cells must be crosses.`,
        });
      }
    }
  }

  // Try to find a clear hint first
  const hint = findSaturationHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}

