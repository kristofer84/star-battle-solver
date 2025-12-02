import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { getCell, emptyCells, countStars, formatRow, formatCol, formatRegion } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `n-rooks-${hintCounter}`;
}

/**
 * N-rooks technique:
 *
 * If N cells in N different rows and N different columns must all contain stars
 * (because they are the only possible positions for stars in their respective units),
 * then we can place stars in all N cells.
 *
 * This is similar to the rook placement problem in chess - N rooks on an N×N board
 * such that no two rooks attack each other (different rows and columns).
 *
 * Example:
 * - Cell (2,5) is the only place for a star in row 2
 * - Cell (7,3) is the only place for a star in column 3
 * - Cell (4,8) is the only place for a star in region 6
 * If these cells form a rook pattern (all different rows and columns),
 * they must all be stars.
 */
export function findNRooksHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Find cells that are forced by their units (only position for a star)
  const forcedCells = findForcedCellsByUnit(state);

  if (forcedCells.length < 2) return null;

  // Look for N-rooks patterns in the forced cells
  // Try different sizes starting from largest to prefer bigger patterns
  for (let n = Math.min(forcedCells.length, size); n >= 2; n -= 1) {
    const rookPattern = findRookPattern(forcedCells, n);
    if (rookPattern) {
      return createRookHint(rookPattern);
    }
  }

  return null;
}

/**
 * Find cells that are forced to be stars by their units.
 * A cell is forced if it's the only empty cell that can satisfy a unit's star requirement.
 */
function findForcedCellsByUnit(state: PuzzleState): ForcedCell[] {
  const forcedCells: ForcedCell[] = [];
  const { size, starsPerUnit } = state.def;

  // Check rows
  for (let row = 0; row < size; row += 1) {
    const rowCells: Coords[] = [];
    for (let col = 0; col < size; col += 1) {
      rowCells.push({ row, col });
    }

    const stars = countStars(state, rowCells);
    const empties = emptyCells(state, rowCells);

    // If this row needs exactly 1 more star and has exactly 1 empty cell
    if (stars === starsPerUnit - 1 && empties.length === 1) {
      forcedCells.push({
        cell: empties[0],
        unitType: 'row',
        unitId: row,
      });
    }
  }

  // Check columns
  for (let col = 0; col < size; col += 1) {
    const colCells: Coords[] = [];
    for (let row = 0; row < size; row += 1) {
      colCells.push({ row, col });
    }

    const stars = countStars(state, colCells);
    const empties = emptyCells(state, colCells);

    // If this column needs exactly 1 more star and has exactly 1 empty cell
    if (stars === starsPerUnit - 1 && empties.length === 1) {
      forcedCells.push({
        cell: empties[0],
        unitType: 'col',
        unitId: col,
      });
    }
  }

  // Check regions
  for (let regionId = 1; regionId <= 10; regionId += 1) {
    const regionCells: Coords[] = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (state.def.regions[row][col] === regionId) {
          regionCells.push({ row, col });
        }
      }
    }

    const stars = countStars(state, regionCells);
    const empties = emptyCells(state, regionCells);

    // If this region needs exactly 1 more star and has exactly 1 empty cell
    if (stars === starsPerUnit - 1 && empties.length === 1) {
      forcedCells.push({
        cell: empties[0],
        unitType: 'region',
        unitId: regionId,
      });
    }
  }

  return forcedCells;
}

interface ForcedCell {
  cell: Coords;
  unitType: 'row' | 'col' | 'region';
  unitId: number;
}

/**
 * Find a rook pattern: N cells in N different rows and N different columns.
 */
function findRookPattern(forcedCells: ForcedCell[], n: number): ForcedCell[] | null {
  // Try all combinations of n forced cells
  const combinations = getCombinations(forcedCells, n);

  for (const combo of combinations) {
    // Check if these cells form a rook pattern
    const rows = new Set(combo.map((fc) => fc.cell.row));
    const cols = new Set(combo.map((fc) => fc.cell.col));

    // Valid rook pattern: N cells in N different rows and N different columns
    if (rows.size === n && cols.size === n) {
      return combo;
    }
  }

  return null;
}

/**
 * Generate all combinations of size k from array.
 */
function getCombinations<T>(array: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > array.length) return [];

  const result: T[][] = [];

  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }

    for (let i = start; i < array.length; i += 1) {
      current.push(array[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return result;
}

/**
 * Create a hint for the N-rooks pattern.
 */
function createRookHint(rookPattern: ForcedCell[]): Hint {
  const cells = rookPattern.map((fc) => fc.cell);
  const rows = Array.from(new Set(cells.map((c) => c.row)));
  const cols = Array.from(new Set(cells.map((c) => c.col)));
  const regions = new Set<number>();

  // Build explanation
  const explanationParts: string[] = [];
  for (const fc of rookPattern) {
    const unitName =
      fc.unitType === 'row'
        ? formatRow(fc.unitId).toLowerCase()
        : fc.unitType === 'col'
        ? formatCol(fc.unitId).toLowerCase()
        : `region ${formatRegion(fc.unitId)}`;
    explanationParts.push(
      `(${fc.cell.row},${fc.cell.col}) is forced by ${unitName}`
    );
  }

  const n = rookPattern.length;
  const explanation = `N-Rooks (${n}): These ${n} cells form a rook pattern - they are in ${n} different rows and ${n} different columns, and each is forced by its unit. ${explanationParts.join('; ')}.`;

  return {
    id: nextHintId(),
    kind: 'place-star',
    technique: 'n-rooks',
    resultCells: cells,
    explanation,
    highlights: {
      cells,
      rows,
      cols,
    },
  };
}
