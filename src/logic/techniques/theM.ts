import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import {
  isValidStarPlacement,
  canPlaceAllStarsSimultaneously,
} from '../constraints/placement';
import { findMShapes, getCell, emptyCells, countStars, neighbors8 } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `the-m-${hintCounter}`;
}

/**
 * The M technique:
 * 
 * When a region forms an M-shape (two peaks with a valley between them),
 * the constraint that the region needs 2 stars combined with the spatial
 * structure of the M can force specific star placements.
 * 
 * Key insight: In an M-shape, the two peaks are separated by a valley.
 * The adjacency and 2×2 constraints combined with the need for 2 stars
 * in the region can force stars into specific positions.
 */
export function findTheMHint(state: PuzzleState): Hint | null {
  const mShapes = findMShapes(state);
  
  if (mShapes.length === 0) return null;
  
  // Analyze each M-shape for forced cells
  for (const mShape of mShapes) {
    const forcedCells = analyzeMShape(state, mShape);
    
    if (forcedCells.length > 0) {
      return {
        id: nextHintId(),
        kind: forcedCells[0].kind,
        technique: 'the-m',
        resultCells: forcedCells.map((fc) => fc.cell),
        explanation: `Region ${mShape.regionId} forms an M-shape with two peaks and a valley. The spatial constraints from needing 2 stars in this M-shaped region, combined with adjacency and 2×2 rules, force specific placements.`,
        highlights: {
          regions: [mShape.regionId],
          cells: [...mShape.cells, ...forcedCells.map((fc) => fc.cell)],
        },
      };
    }
  }
  
  return null;
}

/**
 * Find result with deductions support
 */
export function findTheMResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findTheMHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // The M finds forced cells in M-shaped regions.
  // We could emit AreaDeduction for M-shaped regions,
  // but the technique is pattern-specific and primarily produces hints directly.

  return { type: 'none' };
}

interface ForcedCell {
  cell: Coords;
  kind: 'place-star' | 'place-cross';
}

/**
 * Analyze an M-shape to find forced cells
 */
function analyzeMShape(
  state: PuzzleState,
  mShape: ReturnType<typeof findMShapes>[0]
): ForcedCell[] {
  const forcedCells: ForcedCell[] = [];

  const starsInRegion = countStars(state, mShape.cells);
  const emptiesInRegion = emptyCells(state, mShape.cells);
  const viableEmpties = emptiesInRegion.filter((cell) => isValidStarPlacement(state, cell));
  const starsNeeded = state.def.starsPerUnit - starsInRegion;

  // If region is already satisfied or has no empties, no forcing
  if (starsNeeded === 0 || viableEmpties.length === 0) return [];

  if (viableEmpties.length < starsNeeded) return [];

  // Strategy 1: If we need exactly as many stars as we have empties, all empties are stars
  if (starsNeeded === viableEmpties.length) {
    const validated = canPlaceAllStarsSimultaneously(state, viableEmpties, state.def.starsPerUnit);
    if (!validated) return [];

    for (const cell of validated) {
      forcedCells.push({ cell, kind: 'place-star' });
    }
    return forcedCells;
  }
  
  // Strategy 2: Analyze the M-shape structure
  // The two peaks are separated by the valley. If placing a star in certain
  // cells would make it impossible to place the required number of stars
  // due to adjacency constraints, those cells must be crosses.
  
  for (const emptyCell of viableEmpties) {
    // Check if placing a star here would block too many other cells
    const blockedCells = viableEmpties.filter((other) => {
      if (other.row === emptyCell.row && other.col === emptyCell.col) return false;

      // Check if placing a star at emptyCell would force other to be a cross
      const neighbors = neighbors8(emptyCell, state.def.size);
      return neighbors.some((n) => n.row === other.row && n.col === other.col);
    });
    
    // If placing a star here would leave insufficient cells for remaining stars
    const remainingCells = viableEmpties.length - 1 - blockedCells.length;
    if (remainingCells < starsNeeded - 1) {
      forcedCells.push({ cell: emptyCell, kind: 'place-cross' });
    }
  }
  
  // Strategy 3: Check if stars must be in the peaks
  // If the valley and its neighbors would block too many cells, stars must be in peaks
  const peakCells = mShape.peaks;
  const valleyCell = mShape.valley;
  
  // Check if valley is empty and could host a star legally
  if (getCell(state, valleyCell) === 'empty' && isValidStarPlacement(state, valleyCell)) {
    // Count how many cells would be blocked if we place a star in the valley
    const blockedByValley = viableEmpties.filter((cell) => {
      if (cell.row === valleyCell.row && cell.col === valleyCell.col) return false;
      const neighbors = neighbors8(valleyCell, state.def.size);
      return neighbors.some((n) => n.row === cell.row && n.col === cell.col);
    });

    // If placing a star in valley would leave insufficient cells
    const remainingAfterValley = viableEmpties.length - 1 - blockedByValley.length;
    if (remainingAfterValley < starsNeeded - 1) {
      forcedCells.push({ cell: valleyCell, kind: 'place-cross' });
    }
  }
  
  // Deduplicate forced cells
  const seen = new Set<string>();
  return forcedCells.filter((fc) => {
    const key = `${fc.cell.row},${fc.cell.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
