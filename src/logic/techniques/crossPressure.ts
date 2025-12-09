import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, AreaDeduction, CellDeduction } from '../../types/deductions';
import { rowCells, colCells, emptyCells, countCrosses, formatRow, formatCol, neighbors8, getCell } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `cross-pressure-${hintCounter}`;
}

/**
 * Cross Pressure technique:
 * 
 * If a row or column has 7 crosses and 3 empty cells, there must be at least
 * one forced star. If the 3 empty cells are adjacent (contiguous), we can
 * determine the location of two stars. Otherwise, we can determine the location
 * of one star.
 * 
 * For a 10x10 grid with 2 stars per unit:
 * - 7 crosses + 3 empty = 10 cells total
 * - Need 2 stars total, so all 3 empty cells must contain stars
 * - If the 3 cells are adjacent, we can place stars at specific positions
 *   (e.g., positions 0 and 2 of a 3-cell block)
 * - If not adjacent, we need to determine which cells can be stars
 */
export function findCrossPressureHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  
  // FIRST: Check for forced stars (prioritize star placement over cross placement)
  // Check rows
  for (let row = 0; row < size; row += 1) {
    const rowCellsList = rowCells(state, row);
    const crosses = countCrosses(state, rowCellsList);
    const empties = emptyCells(state, rowCellsList);
    const stars = rowCellsList.filter((c) => state.cells[c.row][c.col] === 'star').length;
    
    // Check if this row has 7 crosses and 3 empty cells
    if (crosses === 7 && empties.length === 3 && stars < starsPerUnit) {
      const forcedStars = analyzeForcedStars(state, empties, starsPerUnit - stars, 'row', row);
      if (forcedStars.length > 0) {
        // Also find crosses adjacent to these forced stars
        const forcedCrosses = findCrossesAdjacentToStars(state, forcedStars);
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'cross-pressure',
          resultCells: forcedStars,
          explanation: `${formatRow(row)} has 7 crosses and 3 empty cells. Since this row needs ${starsPerUnit - stars} more star${starsPerUnit - stars !== 1 ? 's' : ''}, ${forcedStars.length === 2 ? 'two stars are forced' : 'one star is forced'} in the empty cells.${forcedCrosses.length > 0 ? ` Additionally, ${forcedCrosses.length} adjacent cell${forcedCrosses.length !== 1 ? 's' : ''} must be crosses.` : ''}`,
          highlights: { rows: [row], cells: [...empties, ...forcedStars, ...forcedCrosses] },
        };
      }
    }
  }
  
  // Check columns
  for (let col = 0; col < size; col += 1) {
    const colCellsList = colCells(state, col);
    const crosses = countCrosses(state, colCellsList);
    const empties = emptyCells(state, colCellsList);
    const stars = colCellsList.filter((c) => state.cells[c.row][c.col] === 'star').length;
    
    // Check if this column has 7 crosses and 3 empty cells
    if (crosses === 7 && empties.length === 3 && stars < starsPerUnit) {
      const forcedStars = analyzeForcedStars(state, empties, starsPerUnit - stars, 'col', col);
      if (forcedStars.length > 0) {
        // Also find crosses adjacent to these forced stars
        const forcedCrosses = findCrossesAdjacentToStars(state, forcedStars);
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'cross-pressure',
          resultCells: forcedStars,
          explanation: `${formatCol(col)} has 7 crosses and 3 empty cells. Since this column needs ${starsPerUnit - stars} more star${starsPerUnit - stars !== 1 ? 's' : ''}, ${forcedStars.length === 2 ? 'two stars are forced' : 'one star is forced'} in the empty cells.${forcedCrosses.length > 0 ? ` Additionally, ${forcedCrosses.length} adjacent cell${forcedCrosses.length !== 1 ? 's' : ''} must be crosses.` : ''}`,
          highlights: { cols: [col], cells: [...empties, ...forcedStars, ...forcedCrosses] },
        };
      }
    }
  }
  
  // SECOND: Check for crosses above/below adjacent empty cell pairs (only if no star hints found)
  // Check rows: if a row has 1 star and 2 adjacent empty cells, crosses above/below are forced
  for (let row = 0; row < size; row += 1) {
    const rowCellsList = rowCells(state, row);
    const empties = emptyCells(state, rowCellsList);
    const stars = rowCellsList.filter((c) => state.cells[c.row][c.col] === 'star').length;
    
    // Check if this row has 1 star and exactly 2 empty cells
    if (stars === 1 && empties.length === 2 && stars < starsPerUnit) {
      // Check if the 2 empty cells are adjacent (horizontally)
      if (empties[0].row === empties[1].row && Math.abs(empties[0].col - empties[1].col) === 1) {
        const forcedCrosses = findCrossesAboveBelowAdjacentPair(state, empties[0], empties[1]);
        if (forcedCrosses.length > 0) {
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'cross-pressure',
            resultCells: forcedCrosses,
            explanation: `${formatRow(row)} has 1 star and 2 adjacent empty cells. Since one of these cells must be a star, the cells directly above and below the pair must be crosses.`,
            highlights: { rows: [row], cells: [...empties, ...forcedCrosses] },
          };
        }
      }
    }
  }
  
  // Check columns: if a column has 1 star and 2 adjacent empty cells, crosses left/right are forced
  for (let col = 0; col < size; col += 1) {
    const colCellsList = colCells(state, col);
    const empties = emptyCells(state, colCellsList);
    const stars = colCellsList.filter((c) => state.cells[c.row][c.col] === 'star').length;
    
    // Check if this column has 1 star and exactly 2 empty cells
    if (stars === 1 && empties.length === 2 && stars < starsPerUnit) {
      // Check if the 2 empty cells are adjacent (vertically)
      if (empties[0].col === empties[1].col && Math.abs(empties[0].row - empties[1].row) === 1) {
        const forcedCrosses = findCrossesLeftRightAdjacentPair(state, empties[0], empties[1]);
        if (forcedCrosses.length > 0) {
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'cross-pressure',
            resultCells: forcedCrosses,
            explanation: `${formatCol(col)} has 1 star and 2 adjacent empty cells. Since one of these cells must be a star, the cells directly to the left and right of the pair must be crosses.`,
            highlights: { cols: [col], cells: [...empties, ...forcedCrosses] },
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Find result with deductions support
 */
export function findCrossPressureResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findCrossPressureHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // Cross pressure finds forced stars/crosses when rows/columns have specific patterns.
  // We could emit AreaDeduction for rows/columns with forced patterns,
  // but the technique is specific and primarily produces hints directly.

  return { type: 'none' };
}

/**
 * Analyze empty cells to determine forced star placements
 */
function analyzeForcedStars(
  state: PuzzleState,
  empties: Coords[],
  starsNeeded: number,
  unitType: 'row' | 'col',
  unitId: number
): Coords[] {
  if (empties.length !== 3 || starsNeeded !== 2) {
    // This technique only applies when we have exactly 3 empties and need 2 stars
    return [];
  }
  
  // Check if the 3 empty cells are adjacent (contiguous)
  const areAdjacent = checkIfAdjacent(empties, unitType);
  
  if (areAdjacent) {
    // If adjacent, we can place 2 stars at the ends
    return findStarsInAdjacentBlock(state, empties, unitType);
  } else {
    // If not adjacent, we need to find which cell(s) can be forced
    // Since we need 2 stars and they're not adjacent, we can't place both
    // But we might be able to determine one forced star
    return findOneForcedStar(state, empties);
  }
}

/**
 * Check if the 3 empty cells form a contiguous block
 */
function checkIfAdjacent(empties: Coords[], unitType: 'row' | 'col'): boolean {
  if (empties.length !== 3) return false;
  
  // Sort by the relevant coordinate
  const sorted = [...empties].sort((a, b) => {
    if (unitType === 'row') {
      return a.col - b.col;
    } else {
      return a.row - b.row;
    }
  });
  
  // Check if they form a contiguous block
  if (unitType === 'row') {
    // All same row, columns are consecutive
    const sameRow = sorted[0].row === sorted[1].row && sorted[1].row === sorted[2].row;
    const consecutiveCols = 
      sorted[1].col === sorted[0].col + 1 && 
      sorted[2].col === sorted[1].col + 1;
    return sameRow && consecutiveCols;
  } else {
    // All same column, rows are consecutive
    const sameCol = sorted[0].col === sorted[1].col && sorted[1].col === sorted[2].col;
    const consecutiveRows = 
      sorted[1].row === sorted[0].row + 1 && 
      sorted[2].row === sorted[1].row + 1;
    return sameCol && consecutiveRows;
  }
}

/**
 * Find 2 stars in an adjacent block of 3 cells
 * Place stars at positions 0 and 2 (skipping the middle)
 */
function findStarsInAdjacentBlock(
  state: PuzzleState,
  empties: Coords[],
  unitType: 'row' | 'col'
): Coords[] {
  // Sort by the relevant coordinate
  const sorted = [...empties].sort((a, b) => {
    if (unitType === 'row') {
      return a.col - b.col;
    } else {
      return a.row - b.row;
    }
  });
  
  const forcedStars: Coords[] = [];
  
  // Place stars at the first and last positions (positions 0 and 2)
  const firstCell = sorted[0];
  const lastCell = sorted[2];
  
  // Check if we can place stars at both positions
  // They should not be adjacent to each other (they're separated by the middle cell)
  // and should not violate other constraints
  if (canPlaceStar(state, firstCell) && canPlaceStar(state, lastCell)) {
    // Verify they're not adjacent to each other (they shouldn't be, but check anyway)
    if (!areCellsAdjacent(firstCell, lastCell)) {
      forcedStars.push(firstCell, lastCell);
    }
  }
  
  return forcedStars;
}

/**
 * Find one forced star when cells are not adjacent
 * If we need 2 stars and have 3 cells, and any 2 cells are adjacent,
 * then the third (non-adjacent) cell must be a star
 */
function findOneForcedStar(state: PuzzleState, empties: Coords[]): Coords[] {
  // Check all pairs: if any pair is adjacent, the third cell must be a star
  for (let i = 0; i < empties.length; i += 1) {
    for (let j = i + 1; j < empties.length; j += 1) {
      if (areCellsAdjacent(empties[i], empties[j])) {
        // These two are adjacent, so they can't both be stars
        // Since we need 2 stars total, the third cell must be a star
        const thirdCell = empties.find(
          (c) => (c.row !== empties[i].row || c.col !== empties[i].col) &&
                 (c.row !== empties[j].row || c.col !== empties[j].col)
        );
        if (thirdCell && canPlaceStar(state, thirdCell)) {
          return [thirdCell];
        }
      }
    }
  }
  
  return [];
}

/**
 * Check if two cells are adjacent (including diagonally)
 */
function areCellsAdjacent(c1: Coords, c2: Coords): boolean {
  const rowDiff = Math.abs(c1.row - c2.row);
  const colDiff = Math.abs(c1.col - c2.col);
  return rowDiff <= 1 && colDiff <= 1 && (rowDiff > 0 || colDiff > 0);
}

/**
 * Check if we can place a star at this cell (no adjacency violations)
 */
function canPlaceStar(state: PuzzleState, cell: Coords): boolean {
  // Check if cell is already occupied
  if (state.cells[cell.row][cell.col] !== 'empty') {
    return false;
  }
  
  // Check for adjacent stars
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = cell.row + dr;
      const nc = cell.col + dc;
      if (nr >= 0 && nr < state.def.size && nc >= 0 && nc < state.def.size) {
        if (state.cells[nr][nc] === 'star') {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Find crosses that must be placed adjacent to forced stars
 */
function findCrossesAdjacentToStars(state: PuzzleState, stars: Coords[]): Coords[] {
  const forcedCrosses: Coords[] = [];
  const seen = new Set<string>();
  
  for (const star of stars) {
    const neighbors = neighbors8(star, state.def.size);
    for (const neighbor of neighbors) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Only add if it's empty (not already a cross or star)
      if (getCell(state, neighbor) === 'empty') {
        forcedCrosses.push(neighbor);
      }
    }
  }
  
  return forcedCrosses;
}

/**
 * Find crosses that must be placed above and below a pair of adjacent empty cells in a row
 * If we have 2 adjacent empty cells and need 1 more star, whichever cell becomes a star
 * will force crosses in the cells directly above and below both positions
 */
function findCrossesAboveBelowAdjacentPair(
  state: PuzzleState,
  cell1: Coords,
  cell2: Coords
): Coords[] {
  const forcedCrosses: Coords[] = [];
  const seen = new Set<string>();
  
  // Both cells are in the same row, adjacent horizontally
  const row = cell1.row;
  const col1 = Math.min(cell1.col, cell2.col);
  const col2 = Math.max(cell1.col, cell2.col);
  
  // Check cells above the pair (row - 1, col1) and (row - 1, col2)
  if (row > 0) {
    const above1: Coords = { row: row - 1, col: col1 };
    const above2: Coords = { row: row - 1, col: col2 };
    
    for (const cell of [above1, above2]) {
      const key = `${cell.row},${cell.col}`;
      if (!seen.has(key) && getCell(state, cell) === 'empty') {
        forcedCrosses.push(cell);
        seen.add(key);
      }
    }
  }
  
  // Check cells below the pair (row + 1, col1) and (row + 1, col2)
  if (row < state.def.size - 1) {
    const below1: Coords = { row: row + 1, col: col1 };
    const below2: Coords = { row: row + 1, col: col2 };
    
    for (const cell of [below1, below2]) {
      const key = `${cell.row},${cell.col}`;
      if (!seen.has(key) && getCell(state, cell) === 'empty') {
        forcedCrosses.push(cell);
        seen.add(key);
      }
    }
  }
  
  return forcedCrosses;
}

/**
 * Find crosses that must be placed to the left and right of a pair of adjacent empty cells in a column
 * If we have 2 adjacent empty cells and need 1 more star, whichever cell becomes a star
 * will force crosses in the cells directly to the left and right of both positions
 */
function findCrossesLeftRightAdjacentPair(
  state: PuzzleState,
  cell1: Coords,
  cell2: Coords
): Coords[] {
  const forcedCrosses: Coords[] = [];
  const seen = new Set<string>();
  
  // Both cells are in the same column, adjacent vertically
  const col = cell1.col;
  const row1 = Math.min(cell1.row, cell2.row);
  const row2 = Math.max(cell1.row, cell2.row);
  
  // Check cells to the left of the pair (row1, col - 1) and (row2, col - 1)
  if (col > 0) {
    const left1: Coords = { row: row1, col: col - 1 };
    const left2: Coords = { row: row2, col: col - 1 };
    
    for (const cell of [left1, left2]) {
      const key = `${cell.row},${cell.col}`;
      if (!seen.has(key) && getCell(state, cell) === 'empty') {
        forcedCrosses.push(cell);
        seen.add(key);
      }
    }
  }
  
  // Check cells to the right of the pair (row1, col + 1) and (row2, col + 1)
  if (col < state.def.size - 1) {
    const right1: Coords = { row: row1, col: col + 1 };
    const right2: Coords = { row: row2, col: col + 1 };
    
    for (const cell of [right1, right2]) {
      const key = `${cell.row},${cell.col}`;
      if (!seen.has(key) && getCell(state, cell) === 'empty') {
        forcedCrosses.push(cell);
        seen.add(key);
      }
    }
  }
  
  return forcedCrosses;
}

