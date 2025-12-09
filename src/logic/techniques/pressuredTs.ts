import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import {
  isValidStarPlacement,
  canPlaceAllStarsSimultaneously,
} from '../constraints/placement';
import { findTShapes, emptyCells, countStars, neighbors8 } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `pressured-ts-${hintCounter}`;
}

/**
 * Pressured Ts technique:
 * 
 * When a T-shaped region is under pressure from surrounding constraints
 * (crosses, adjacent stars, or 2×2 blocks), the constraint that the region
 * needs 2 stars combined with the spatial pressure can force specific
 * star placements.
 * 
 * Key insight: The T-shape has a crossbar and a stem. When surrounding
 * constraints create pressure (limiting where stars can go), the need for
 * 2 stars in the region forces specific placements.
 */
export function findPressuredTsHint(state: PuzzleState): Hint | null {
  const tShapes = findTShapes(state);
  
  if (tShapes.length === 0) return null;
  
  // Analyze each T-shape for forced cells under pressure
  for (const tShape of tShapes) {
    const forcedCells = analyzePressuredT(state, tShape);
    
    if (forcedCells.length > 0) {
      return {
        id: nextHintId(),
        kind: forcedCells[0].kind,
        technique: 'pressured-ts',
        resultCells: forcedCells.map((fc) => fc.cell),
        explanation: `Region ${tShape.regionId} forms a T-shape. Surrounding constraints (crosses, adjacent stars, or 2×2 blocks) create pressure that limits where stars can be placed. Combined with the need for 2 stars in this region, specific placements are forced.`,
        highlights: {
          regions: [tShape.regionId],
          cells: [...tShape.cells, ...forcedCells.map((fc) => fc.cell)],
        },
      };
    }
  }
  
  return null;
}

/**
 * Find result with deductions support
 */
export function findPressuredTsResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findPressuredTsHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // Pressured Ts finds forced cells in T-shaped regions under pressure.
  // We could emit AreaDeduction for T-shaped regions,
  // but the technique is pattern-specific and primarily produces hints directly.

  return { type: 'none' };
}

interface ForcedCell {
  cell: Coords;
  kind: 'place-star' | 'place-cross';
}

/**
 * Analyze a T-shape under pressure to find forced cells
 */
function analyzePressuredT(
  state: PuzzleState,
  tShape: ReturnType<typeof findTShapes>[0]
): ForcedCell[] {
  const forcedCells: ForcedCell[] = [];

  const starsInRegion = countStars(state, tShape.cells);
  const emptiesInRegion = emptyCells(state, tShape.cells);
  const viableEmpties = emptiesInRegion.filter(
    (cell) =>
      isValidStarPlacement(state, cell) &&
      canPlaceAllStarsSimultaneously(state, [cell], state.def.starsPerUnit) !== null
  );
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
  
  // Strategy 2: Analyze pressure from surrounding constraints
  // Count how many viable positions exist for stars in different parts of the T
  
  // Separate empties into crossbar and stem
  const crossbarEmpties = viableEmpties.filter((cell) =>
    tShape.crossbar.some((c) => c.row === cell.row && c.col === cell.col)
  );

  const stemEmpties = viableEmpties.filter((cell) =>
    tShape.stem.some((c) => c.row === cell.row && c.col === cell.col)
  );
  
  // Strategy 3: Check for external pressure FIRST (prioritize forced stars)
  // If the crossbar or stem has limited viable positions due to external constraints,
  // we may be able to force placements
  
  // Get viable cells in crossbar and stem
  const viableCrossbarCells = getViableCells(state, crossbarEmpties);
  const viableStemCells = getViableCells(state, stemEmpties);
  
  // Total viable positions in the entire T-shape
  const totalViablePositions = viableCrossbarCells.length + viableStemCells.length;

  // If total viable positions equals stars needed, all viable positions must be stars
  if (totalViablePositions === starsNeeded && totalViablePositions > 0) {
    const validated = canPlaceAllStarsSimultaneously(
      state,
      [...viableCrossbarCells, ...viableStemCells],
      state.def.starsPerUnit
    );
    if (!validated) return [];

    for (const cell of validated) {
      if (!forcedCells.some((fc) => fc.cell.row === cell.row && fc.cell.col === cell.col)) {
        forcedCells.push({ cell, kind: 'place-star' });
      }
    }
    return forcedCells; // Return early if we found forced stars
  }

  // If one part has no viable positions, all stars must go in the other part
  if (viableCrossbarCells.length === 0 && viableStemCells.length === starsNeeded) {
    const validated = canPlaceAllStarsSimultaneously(state, viableStemCells, state.def.starsPerUnit);
    if (!validated) return [];

    for (const cell of validated) {
      if (!forcedCells.some((fc) => fc.cell.row === cell.row && fc.cell.col === cell.col)) {
        forcedCells.push({ cell, kind: 'place-star' });
      }
    }
    return forcedCells; // Return early
  }

  if (viableStemCells.length === 0 && viableCrossbarCells.length === starsNeeded) {
    const validated = canPlaceAllStarsSimultaneously(state, viableCrossbarCells, state.def.starsPerUnit);
    if (!validated) return [];

    for (const cell of validated) {
      if (!forcedCells.some((fc) => fc.cell.row === cell.row && fc.cell.col === cell.col)) {
        forcedCells.push({ cell, kind: 'place-star' });
      }
    }
    return forcedCells; // Return early
  }
  
  // Strategy 4: Check if placing a star in certain cells would block too many others
  // (Only do this if we didn't find forced stars above)
  for (const emptyCell of viableEmpties) {
    // Count how many other empty cells would be blocked by placing a star here
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
  
  // Deduplicate forced cells
  const seen = new Set<string>();
  return forcedCells.filter((fc) => {
    const key = `${fc.cell.row},${fc.cell.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get all viable cells from the given list
 */
function getViableCells(state: PuzzleState, cells: Coords[]): Coords[] {
  return cells.filter((cell) => isViablePosition(state, cell));
}

/**
 * Check if a position is viable for placing a star using shared legality helpers
 */
function isViablePosition(state: PuzzleState, cell: Coords): boolean {
  if (!isValidStarPlacement(state, cell)) return false;

  return canPlaceAllStarsSimultaneously(state, [cell], state.def.starsPerUnit) !== null;
}
