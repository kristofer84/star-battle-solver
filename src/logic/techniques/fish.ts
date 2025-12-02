import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { rowCells, colCells, emptyCells, countStars, getCell } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `fish-${hintCounter}`;
}

/**
 * Fish technique (analogous to Sudoku fish patterns like X-Wing, Swordfish):
 *
 * If N rows contain possible star positions only in the same N columns,
 * then those N columns must contain all stars for those N rows.
 * Therefore, any other cells in those N columns (outside the N rows) cannot be stars.
 *
 * Similarly works with columns as base and rows as cover.
 *
 * Example (X-Wing, N=2):
 * - Rows 3 and 7 each need stars, and their possible positions are only in columns 2 and 5
 * - Then columns 2 and 5 must contain the stars for rows 3 and 7
 * - All other cells in columns 2 and 5 (not in rows 3 or 7) must be crosses
 */
export function findFishHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Try fish with rows as base units (eliminating from columns)
  const rowFish = findFishPattern(state, 'row');
  if (rowFish) return rowFish;

  // Try fish with columns as base units (eliminating from rows)
  const colFish = findFishPattern(state, 'col');
  if (colFish) return colFish;

  return null;
}

function findFishPattern(
  state: PuzzleState,
  baseType: 'row' | 'col'
): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Try different fish sizes (2 = X-Wing, 3 = Swordfish, etc.)
  // Start with smaller sizes as they're more common
  for (let fishSize = 2; fishSize <= Math.min(4, size - 1); fishSize += 1) {
    const hint = findFishOfSize(state, baseType, fishSize);
    if (hint) return hint;
  }

  return null;
}

function findFishOfSize(
  state: PuzzleState,
  baseType: 'row' | 'col',
  fishSize: number
): Hint | null {
  const { size, starsPerUnit } = state.def;
  const coverType = baseType === 'row' ? 'col' : 'row';

  // Get all base units (rows or columns) that still need stars
  const baseUnits: number[] = [];
  for (let i = 0; i < size; i += 1) {
    const cells = baseType === 'row' ? rowCells(state, i) : colCells(state, i);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    
    // Only consider units that still need stars and have empty cells
    if (stars < starsPerUnit && empties.length > 0) {
      baseUnits.push(i);
    }
  }

  // Try all combinations of fishSize base units
  const baseCombinations = combinations(baseUnits, fishSize);

  for (const baseSet of baseCombinations) {
    // For these base units, find which cover units contain possible star positions
    const coverUnitsUsed = new Set<number>();
    const possibleCells: Coords[] = [];

    for (const baseIdx of baseSet) {
      const baseCells = baseType === 'row' ? rowCells(state, baseIdx) : colCells(state, baseIdx);
      const empties = emptyCells(state, baseCells);

      for (const cell of empties) {
        const coverIdx = baseType === 'row' ? cell.col : cell.row;
        coverUnitsUsed.add(coverIdx);
        possibleCells.push(cell);
      }
    }

    // Fish pattern: if N base units use exactly N cover units
    if (coverUnitsUsed.size === fishSize) {
      // Find elimination cells: cells in the cover units but not in base units
      const eliminationCells: Coords[] = [];
      const coverArray = Array.from(coverUnitsUsed);

      for (const coverIdx of coverArray) {
        const coverCells = coverType === 'row' ? rowCells(state, coverIdx) : colCells(state, coverIdx);
        const empties = emptyCells(state, coverCells);

        for (const cell of empties) {
          const baseIdx = baseType === 'row' ? cell.row : cell.col;
          
          // If this cell is not in one of our base units, it can be eliminated
          if (!baseSet.includes(baseIdx)) {
            eliminationCells.push(cell);
          }
        }
      }

      if (eliminationCells.length > 0) {
        const baseUnitName = baseType === 'row' ? 'row' : 'column';
        const coverUnitName = coverType === 'row' ? 'row' : 'column';
        const baseList = baseSet.map((i) => i).join(', ');
        const coverList = coverArray.map((i) => i).join(', ');

        const fishName = fishSize === 2 ? 'X-Wing' : fishSize === 3 ? 'Swordfish' : `${fishSize}-Fish`;

        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'fish',
          resultCells: eliminationCells,
          explanation: `${fishName}: ${baseUnitName}s ${baseList} can only place stars in ${coverUnitName}s ${coverList}. Therefore, all other cells in ${coverUnitName}s ${coverList} must be crosses.`,
          highlights: {
            cells: [...possibleCells, ...eliminationCells],
            ...(baseType === 'row' ? { rows: baseSet } : { cols: baseSet }),
            ...(coverType === 'row' ? { rows: coverArray } : { cols: coverArray }),
          },
        };
      }
    }
  }

  return null;
}

/**
 * Generate all combinations of size k from array
 */
function combinations<T>(array: T[], k: number): T[][] {
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
