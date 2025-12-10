import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, AreaDeduction } from '../../types/deductions';
import { rowCells, colCells, regionCells, emptyCells, countStars, neighbors8, formatRow, formatCol, formatRegion } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `exact-fill-${hintCounter}`;
}

/**
 * Exact Fill:
 *
 * If a row/column/region has exactly as many empty cells as remaining stars,
 * then all of those empty cells must be stars.
 *
 * This is a straightforward counting consequence and is always sound.
 *
 * IMPORTANT: We must verify that placing stars in all empty cells won't create
 * adjacency violations between the newly placed stars themselves.
 */
function cellsAreAdjacent(cell1: { row: number; col: number }, cell2: { row: number; col: number }): boolean {
  const dr = Math.abs(cell1.row - cell2.row);
  const dc = Math.abs(cell1.col - cell2.col);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

function hasAdjacentCells(cells: { row: number; col: number }[]): boolean {
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (cellsAreAdjacent(cells[i], cells[j])) {
        return true;
      }
    }
  }
  return false;
}

function hasAdjacentToStars(state: PuzzleState, cells: { row: number; col: number }[]): boolean {
  const { size } = state.def;
  for (const cell of cells) {
    const neighbors = neighbors8(cell, size);
    for (const neighbor of neighbors) {
      if (state.cells[neighbor.row][neighbor.col] === 'star') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if placing stars in all given cells would violate any region quota
 */
function wouldViolateRegionQuota(state: PuzzleState, cells: { row: number; col: number }[]): boolean {
  const { starsPerUnit, regions } = state.def;
  const regionStarCounts = new Map<number, number>();
  
  // Count how many stars would be added to each region
  for (const cell of cells) {
    const regionId = regions[cell.row][cell.col];
    regionStarCounts.set(regionId, (regionStarCounts.get(regionId) || 0) + 1);
  }
  
  // Check each affected region
  for (const [regionId, newStars] of regionStarCounts) {
    // Count current stars in this region
    let currentStars = 0;
    for (let r = 0; r < state.def.size; r++) {
      for (let c = 0; c < state.def.size; c++) {
        if (regions[r][c] === regionId && state.cells[r][c] === 'star') {
          currentStars++;
        }
      }
    }
    
    // Check if adding new stars would exceed quota
    if (currentStars + newStars > starsPerUnit) {
      return true;
    }
  }
  
  return false;
}

export function findExactFillHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Rows
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const empties = emptyCells(state, row);
    if (empties.length === 0) continue;
    const starCount = countStars(state, row);
    const remaining = starsPerUnit - starCount;
    if (remaining > 0 && remaining === empties.length) {
      // Check that placing stars in all empty cells won't create adjacency violations
      if (hasAdjacentCells(empties)) {
        continue; // Skip this row if empty cells are adjacent to each other
      }
      if (hasAdjacentToStars(state, empties)) {
        continue; // Skip this row if empty cells are adjacent to existing stars
      }
      // Check that placing stars won't violate region quotas
      if (wouldViolateRegionQuota(state, empties)) {
        continue; // Skip this row if it would violate region quotas
      }
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'exact-fill',
        resultCells: empties,
        explanation: `${formatRow(r)} needs ${remaining} more star(s) and has exactly ${empties.length} empty cells left, so all of them must be stars.`,
        highlights: { rows: [r], cells: empties },
      };
    }
  }

  // Columns
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const empties = emptyCells(state, col);
    if (empties.length === 0) continue;
    const starCount = countStars(state, col);
    const remaining = starsPerUnit - starCount;
    if (remaining > 0 && remaining === empties.length) {
      // Check that placing stars in all empty cells won't create adjacency violations
      if (hasAdjacentCells(empties)) {
        continue; // Skip this column if empty cells are adjacent to each other
      }
      if (hasAdjacentToStars(state, empties)) {
        continue; // Skip this column if empty cells are adjacent to existing stars
      }
      // Check that placing stars won't violate region quotas
      if (wouldViolateRegionQuota(state, empties)) {
        continue; // Skip this column if it would violate region quotas
      }
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'exact-fill',
        resultCells: empties,
        explanation: `${formatCol(c)} needs ${remaining} more star(s) and has exactly ${empties.length} empty cells left, so all of them must be stars.`,
        highlights: { cols: [c], cells: empties },
      };
    }
  }

  // Regions
  for (let regionId = 0; regionId <= 9; regionId += 1) {
    const region = regionCells(state, regionId);
    if (!region.length) continue;
    const empties = emptyCells(state, region);
    if (empties.length === 0) continue;
    const starCount = countStars(state, region);
    const remaining = starsPerUnit - starCount;
    if (remaining > 0 && remaining === empties.length) {
      // Check that placing stars in all empty cells won't create adjacency violations
      if (hasAdjacentCells(empties)) {
        continue; // Skip this region if empty cells are adjacent to each other
      }
      if (hasAdjacentToStars(state, empties)) {
        continue; // Skip this region if empty cells are adjacent to existing stars
      }
      // Check that placing stars won't violate row/column quotas
      // Group empties by row and column to check quotas
      const rowCounts = new Map<number, number>();
      const colCounts = new Map<number, number>();
      for (const cell of empties) {
        rowCounts.set(cell.row, (rowCounts.get(cell.row) || 0) + 1);
        colCounts.set(cell.col, (colCounts.get(cell.col) || 0) + 1);
      }
      // Check row quotas - skip region if any row would be violated
      let violatesQuota = false;
      for (const [row, newStars] of rowCounts) {
        const rowCells_list = rowCells(state, row);
        const currentStars = countStars(state, rowCells_list);
        if (currentStars + newStars > starsPerUnit) {
          violatesQuota = true;
          break;
        }
      }
      if (violatesQuota) continue;
      // Check column quotas - skip region if any column would be violated
      for (const [col, newStars] of colCounts) {
        const colCells_list = colCells(state, col);
        const currentStars = countStars(state, colCells_list);
        if (currentStars + newStars > starsPerUnit) {
          violatesQuota = true;
          break;
        }
      }
      if (violatesQuota) continue;
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'exact-fill',
        resultCells: empties,
        explanation: `Region ${formatRegion(regionId)} needs ${remaining} more star(s) and has exactly ${empties.length} empty cells left, so all of them must be stars.`,
        highlights: { regions: [regionId], cells: empties },
      };
    }
  }

  return null;
}

/**
 * Find result with deductions support
 */
export function findExactFillResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit } = state.def;
  const deductions: Deduction[] = [];

  // Check rows, columns, and regions for exact fill situations
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const empties = emptyCells(state, row);
    if (empties.length === 0) continue;
    const starCount = countStars(state, row);
    const remaining = starsPerUnit - starCount;
    if (remaining > 0 && remaining === empties.length) {
      deductions.push({
        kind: 'area',
        technique: 'exact-fill',
        areaType: 'row',
        areaId: r,
        candidateCells: empties,
        starsRequired: remaining,
        explanation: `${formatRow(r)} needs ${remaining} more star(s) and has exactly ${empties.length} empty cell(s), so all must be stars.`,
      });
    }
  }

  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const empties = emptyCells(state, col);
    if (empties.length === 0) continue;
    const starCount = countStars(state, col);
    const remaining = starsPerUnit - starCount;
    if (remaining > 0 && remaining === empties.length) {
      deductions.push({
        kind: 'area',
        technique: 'exact-fill',
        areaType: 'column',
        areaId: c,
        candidateCells: empties,
        starsRequired: remaining,
        explanation: `${formatCol(c)} needs ${remaining} more star(s) and has exactly ${empties.length} empty cell(s), so all must be stars.`,
      });
    }
  }

  for (let regionId = 1; regionId <= 10; regionId += 1) {
    const region = regionCells(state, regionId);
    const empties = emptyCells(state, region);
    if (empties.length === 0) continue;
    const starCount = countStars(state, region);
    const remaining = starsPerUnit - starCount;
    if (remaining > 0 && remaining === empties.length) {
      deductions.push({
        kind: 'area',
        technique: 'exact-fill',
        areaType: 'region',
        areaId: regionId,
        candidateCells: empties,
        starsRequired: remaining,
        explanation: `Region ${formatRegion(regionId)} needs ${remaining} more star(s) and has exactly ${empties.length} empty cell(s), so all must be stars.`,
      });
    }
  }

  // Try to find a clear hint first
  const hint = findExactFillHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}
