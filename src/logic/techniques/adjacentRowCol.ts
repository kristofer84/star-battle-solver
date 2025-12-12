import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, AreaDeduction, CellDeduction } from '../../types/deductions';
import {
  rowCells,
  colCells,
  emptyCells,
  countStars,
  formatRow,
  formatCol,
  neighbors8,
  getCell,
} from '../helpers';
import { canPlaceAllStarsSimultaneously } from '../constraints/placement';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `adjacent-row-col-${hintCounter}`;
}

/**
 * Check if cells in a row are adjacent (contiguous horizontally)
 */
function areCellsAdjacentInRow(cells: Coords[]): boolean {
  if (cells.length === 0) return false;
  
  // All cells must be in the same row
  const row = cells[0].row;
  if (!cells.every(c => c.row === row)) return false;
  
  // Sort by column
  const sorted = [...cells].sort((a, b) => a.col - b.col);
  
  // Check if columns are consecutive
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].col !== sorted[i - 1].col + 1) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if cells in a column are adjacent (contiguous vertically)
 */
function areCellsAdjacentInCol(cells: Coords[]): boolean {
  if (cells.length === 0) return false;
  
  // All cells must be in the same column
  const col = cells[0].col;
  if (!cells.every(c => c.col === col)) return false;
  
  // Sort by row
  const sorted = [...cells].sort((a, b) => a.row - b.row);
  
  // Check if rows are consecutive
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].row !== sorted[i - 1].row + 1) {
      return false;
    }
  }
  
  return true;
}

/**
 * Find cells horizontally adjacent to a column of cells
 * (cells in the same rows, but columns to the left and right)
 */
function findHorizontalAdjacentCells(state: PuzzleState, cells: Coords[]): Coords[] {
  const { size } = state.def;
  const adjacent: Coords[] = [];
  const seen = new Set<string>();
  
  for (const cell of cells) {
    // Left neighbor
    if (cell.col > 0) {
      const left = { row: cell.row, col: cell.col - 1 };
      const key = `${left.row},${left.col}`;
      if (!seen.has(key) && getCell(state, left) === 'empty') {
        seen.add(key);
        adjacent.push(left);
      }
    }
    
    // Right neighbor
    if (cell.col < size - 1) {
      const right = { row: cell.row, col: cell.col + 1 };
      const key = `${right.row},${right.col}`;
      if (!seen.has(key) && getCell(state, right) === 'empty') {
        seen.add(key);
        adjacent.push(right);
      }
    }
  }
  
  return adjacent;
}

/**
 * Find cells vertically adjacent to a row of cells
 * (cells in the same columns, but rows above and below)
 */
function findVerticalAdjacentCells(state: PuzzleState, cells: Coords[]): Coords[] {
  const { size } = state.def;
  const adjacent: Coords[] = [];
  const seen = new Set<string>();
  
  for (const cell of cells) {
    // Top neighbor
    if (cell.row > 0) {
      const top = { row: cell.row - 1, col: cell.col };
      const key = `${top.row},${top.col}`;
      if (!seen.has(key) && getCell(state, top) === 'empty') {
        seen.add(key);
        adjacent.push(top);
      }
    }
    
    // Bottom neighbor
    if (cell.row < size - 1) {
      const bottom = { row: cell.row + 1, col: cell.col };
      const key = `${bottom.row},${bottom.col}`;
      if (!seen.has(key) && getCell(state, bottom) === 'empty') {
        seen.add(key);
        adjacent.push(bottom);
      }
    }
  }
  
  return adjacent;
}

/**
 * Adjacent Row/Column technique:
 * 
 * 1. When there are only 2*x-1 cells left in a row/col and they are adjacent,
 *    all stars can be placed correctly (all empty cells must be stars).
 * 
 * 2. When there are only 2*x cells left in a row/col and they are adjacent,
 *    all adjacent cells (horizontal to cols and vertical to rows) can be x'd.
 */
export function findAdjacentRowColHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  
  // FIRST: Check all star placement patterns (prioritize star hints over cross hints)
  // Check rows for star placement
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const empties = emptyCells(state, row);
    const stars = countStars(state, row);
    const remaining = starsPerUnit - stars;
    
    if (remaining <= 0 || empties.length === 0) continue;
    
    // Pattern 1: 2*x-1 cells left and adjacent -> place all stars
    // For x-star puzzle: if remaining = x and empties.length = 2*x-1, all must be stars
    if (empties.length === 2 * remaining - 1 && areCellsAdjacentInRow(empties)) {
      // Verify we can place all stars without violating constraints
      if (canPlaceAllStarsSimultaneously(state, empties, starsPerUnit) !== null) {
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'adjacent-row-col',
          resultCells: empties,
          explanation: `${formatRow(r)} needs ${remaining} star(s) and has ${empties.length} adjacent empty cells. Since ${empties.length} = 2×${remaining} - 1, all empty cells must be stars.`,
          highlights: {
            rows: [r],
            cells: empties,
          },
        };
      }
    }
  }
  
  // Check columns for star placement
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const empties = emptyCells(state, col);
    const stars = countStars(state, col);
    const remaining = starsPerUnit - stars;
    
    if (remaining <= 0 || empties.length === 0) continue;
    
    // Pattern 1: 2*x-1 cells left and adjacent -> place all stars
    if (empties.length === 2 * remaining - 1 && areCellsAdjacentInCol(empties)) {
      // Verify we can place all stars without violating constraints
      if (canPlaceAllStarsSimultaneously(state, empties, starsPerUnit) !== null) {
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'adjacent-row-col',
          resultCells: empties,
          explanation: `${formatCol(c)} needs ${remaining} star(s) and has ${empties.length} adjacent empty cells. Since ${empties.length} = 2×${remaining} - 1, all empty cells must be stars.`,
          highlights: {
            cols: [c],
            cells: empties,
          },
        };
      }
    }
  }
  
  // SECOND: Check all cross placement patterns (only if no star hints found)
  // Check rows for cross placement
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const empties = emptyCells(state, row);
    const stars = countStars(state, row);
    const remaining = starsPerUnit - stars;
    
    if (remaining <= 0 || empties.length === 0) continue;
    
    // Pattern 2: 2*x cells left and adjacent -> x all vertical adjacent cells
    if (empties.length === 2 * remaining && areCellsAdjacentInRow(empties)) {
      const adjacentCrosses = findVerticalAdjacentCells(state, empties);
      if (adjacentCrosses.length > 0) {
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'adjacent-row-col',
          resultCells: adjacentCrosses,
          explanation: `${formatRow(r)} needs ${remaining} star(s) and has ${empties.length} adjacent empty cells. Since ${empties.length} = 2×${remaining}, all cells directly above and below these cells must be crosses.`,
          highlights: {
            rows: [r],
            cells: [...empties, ...adjacentCrosses],
          },
        };
      }
    }
  }
  
  // Check columns for cross placement
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const empties = emptyCells(state, col);
    const stars = countStars(state, col);
    const remaining = starsPerUnit - stars;
    
    if (remaining <= 0 || empties.length === 0) continue;
    
    // Pattern 2: 2*x cells left and adjacent -> x all horizontal adjacent cells
    if (empties.length === 2 * remaining && areCellsAdjacentInCol(empties)) {
      const adjacentCrosses = findHorizontalAdjacentCells(state, empties);
      if (adjacentCrosses.length > 0) {
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'adjacent-row-col',
          resultCells: adjacentCrosses,
          explanation: `${formatCol(c)} needs ${remaining} star(s) and has ${empties.length} adjacent empty cells. Since ${empties.length} = 2×${remaining}, all cells directly to the left and right of these cells must be crosses.`,
          highlights: {
            cols: [c],
            cells: [...empties, ...adjacentCrosses],
          },
        };
      }
    }
  }
  
  return null;
}

/**
 * Find result with deductions support
 */
export function findAdjacentRowColResult(state: PuzzleState): TechniqueResult {
  const deductions: Deduction[] = [];

  // Try to find a clear hint first
  const hint = findAdjacentRowColHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    // Adjacent row/col finds forced stars/crosses in adjacent regions.
    // We could emit AreaDeduction for regions with constrained placements,
    // but the technique is complex and primarily produces hints directly.
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  // Adjacent row/col finds forced stars/crosses in adjacent regions.
  // We could emit AreaDeduction for regions with constrained placements,
  // but the technique is complex and primarily produces hints directly.

  return { type: 'none' };
}
