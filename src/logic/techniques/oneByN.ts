import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { rowCells, colCells, regionCells, emptyCells, countStars, neighbors8, formatRow, formatCol, formatRegion } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `one-by-n-${hintCounter}`;
}

/**
 * 1×N / "1+n" style bands:
 *
 * If a row/column/region has exactly as many empty cells as remaining stars,
 * then all of those empty cells must be stars.
 *
 * This is a straightforward counting consequence and is always sound, even
 * though it captures only a subset of the full 1×N ideas from the guide.
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

export function findOneByNHint(state: PuzzleState): Hint | null {
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
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'one-by-n',
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
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'one-by-n',
        resultCells: empties,
        explanation: `${formatCol(c)} needs ${remaining} more star(s) and has exactly ${empties.length} empty cells left, so all of them must be stars.`,
        highlights: { cols: [c], cells: empties },
      };
    }
  }

  // Regions
  for (let regionId = 1; regionId <= 10; regionId += 1) {
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
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'one-by-n',
        resultCells: empties,
        explanation: `Region ${formatRegion(regionId)} needs ${remaining} more star(s) and has exactly ${empties.length} empty cells left, so all of them must be stars.`,
        highlights: { regions: [regionId], cells: empties },
      };
    }
  }

  return null;
}


