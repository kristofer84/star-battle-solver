import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import { rowCells, colCells, emptyCells, countStars, getCell, neighbors8 } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `fish-${hintCounter}`;
}

/**
 * Fish technique (X-Wing, Swordfish, etc.):
 *
 * If N base units (rows or cols) have all their valid remaining star positions confined
 * to the same N cover units (cols or rows), AND the total remaining stars needed by the
 * base units equals the total remaining capacity of the cover units, then the cover units
 * receive ALL their remaining stars from the base units. Any cell in the cover units
 * outside the base units must therefore be a cross.
 *
 * The count condition (totalBaseRemaining === totalCoverRemaining) is essential for
 * correctness when starsPerUnit > 1. For starsPerUnit=1 it holds automatically.
 */
export function findFishHint(state: PuzzleState): Hint | null {
  return findFishPattern(state, 'row') ?? findFishPattern(state, 'col');
}

export function findFishResult(state: PuzzleState): TechniqueResult {
  const hint = findFishHint(state);
  if (hint) return { type: 'hint', hint };
  return { type: 'none' };
}

function findFishPattern(state: PuzzleState, baseType: 'row' | 'col'): Hint | null {
  const { size } = state.def;
  for (let fishSize = 2; fishSize <= Math.min(4, size - 1); fishSize++) {
    const hint = findFishOfSize(state, baseType, fishSize);
    if (hint) return hint;
  }
  return null;
}

function findFishOfSize(
  state: PuzzleState,
  baseType: 'row' | 'col',
  fishSize: number,
): Hint | null {
  const { size, starsPerUnit } = state.def;
  const coverType = baseType === 'row' ? 'col' : 'row';

  // Collect base units that still need stars
  const baseUnits: number[] = [];
  for (let i = 0; i < size; i++) {
    const cells = baseType === 'row' ? rowCells(state, i) : colCells(state, i);
    if (countStars(state, cells) < starsPerUnit) baseUnits.push(i);
  }

  for (const baseSet of combinations(baseUnits, fishSize)) {
    const coverUnitsSet = new Set<number>();
    let totalBaseRemaining = 0;
    const possibleCells: Coords[] = [];

    for (const baseIdx of baseSet) {
      const baseCells = baseType === 'row' ? rowCells(state, baseIdx) : colCells(state, baseIdx);
      totalBaseRemaining += starsPerUnit - countStars(state, baseCells);

      for (const cell of emptyCells(state, baseCells)) {
        if (!neighbors8(cell, size).some(nb => getCell(state, nb) === 'star')) {
          coverUnitsSet.add(baseType === 'row' ? cell.col : cell.row);
          possibleCells.push(cell);
        }
      }
    }

    // Base rows/cols must confine to exactly fishSize cover units
    if (coverUnitsSet.size !== fishSize) continue;
    if (totalBaseRemaining === 0) continue;

    // Correctness condition for starsPerUnit > 1:
    // The cover units must need exactly as many stars as the base units will supply.
    // Only then do the cover units receive 0 stars from non-base units.
    const coverArray = Array.from(coverUnitsSet);
    let totalCoverRemaining = 0;
    for (const coverIdx of coverArray) {
      const coverCells = coverType === 'row' ? rowCells(state, coverIdx) : colCells(state, coverIdx);
      totalCoverRemaining += starsPerUnit - countStars(state, coverCells);
    }

    if (totalBaseRemaining !== totalCoverRemaining) continue;

    // Eliminate cells in cover units that are not in any base unit
    const eliminationCells: Coords[] = [];
    for (const coverIdx of coverArray) {
      const coverCells = coverType === 'row' ? rowCells(state, coverIdx) : colCells(state, coverIdx);
      for (const cell of emptyCells(state, coverCells)) {
        const baseIdx = baseType === 'row' ? cell.row : cell.col;
        if (!baseSet.includes(baseIdx)) {
          eliminationCells.push(cell);
        }
      }
    }

    if (eliminationCells.length === 0) continue;

    const fishName = fishSize === 2 ? 'X-Wing' : fishSize === 3 ? 'Swordfish' : `${fishSize}-Fish`;
    const baseUnitName = baseType === 'row' ? 'row' : 'column';
    const coverUnitName = coverType === 'row' ? 'row' : 'column';

    return {
      id: nextHintId(),
      kind: 'place-cross',
      technique: 'fish',
      resultCells: eliminationCells,
      explanation: `${fishName}: ${baseUnitName}s ${baseSet.join(', ')} can only place stars in ${coverUnitName}s ${coverArray.join(', ')}, and together they claim all remaining ${coverUnitName} capacity (${totalBaseRemaining} stars). All other cells in those ${coverUnitName}s must be crosses.`,
      highlights: {
        cells: [...possibleCells, ...eliminationCells],
        ...(baseType === 'row' ? { rows: baseSet } : { cols: baseSet }),
        ...(coverType === 'row' ? { rows: coverArray } : { cols: coverArray }),
      },
    };
  }

  return null;
}

function combinations<T>(array: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > array.length) return [];
  const result: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) { result.push([...current]); return; }
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}
