import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import {
  isValidStarPlacement,
  canPlaceAllStarsSimultaneously,
} from '../constraints/placement';
import { findLShapes, emptyCells } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `kissing-ls-${hintCounter}`;
}

/**
 * Check if two cells are adjacent (including diagonally)
 */
function areAdjacent(c1: Coords, c2: Coords): boolean {
  const rowDiff = Math.abs(c1.row - c2.row);
  const colDiff = Math.abs(c1.col - c2.col);
  return rowDiff <= 1 && colDiff <= 1 && (rowDiff > 0 || colDiff > 0);
}

/**
 * Check if two L-shapes "kiss" (touch each other)
 */
function doLShapesTouch(l1Cells: Coords[], l2Cells: Coords[]): boolean {
  for (const c1 of l1Cells) {
    for (const c2 of l2Cells) {
      if (areAdjacent(c1, c2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Kissing Ls technique:
 * 
 * When two L-shaped regions touch in a specific configuration, the constraint
 * that each region needs 2 stars combined with the adjacency and 2×2 rules
 * can force specific star placements.
 * 
 * The key insight is that when two Ls "kiss", the touching point and the
 * spatial constraints limit where stars can be placed in both regions.
 */
export function findKissingLsHint(state: PuzzleState): Hint | null {
  const lShapes = findLShapes(state);
  
  // Need at least 2 L-shapes to have kissing Ls
  if (lShapes.length < 2) return null;
  
  // Check all pairs of L-shapes
  for (let i = 0; i < lShapes.length; i += 1) {
    for (let j = i + 1; j < lShapes.length; j += 1) {
      const l1 = lShapes[i];
      const l2 = lShapes[j];
      
      // Check if these L-shapes touch
      if (!doLShapesTouch(l1.cells, l2.cells)) continue;
      
      // Analyze the kissing configuration
      const forcedCells = analyzeKissingLs(state, l1, l2);
      
      if (forcedCells.length > 0) {
        return {
          id: nextHintId(),
          kind: forcedCells[0].kind,
          technique: 'kissing-ls',
          resultCells: forcedCells.map((fc) => fc.cell),
          explanation: `Two L-shaped regions (${l1.regionId} and ${l2.regionId}) touch in a kissing configuration. The spatial constraints from both regions requiring 2 stars each, combined with adjacency and 2×2 rules, force specific placements.`,
          highlights: {
            regions: [l1.regionId, l2.regionId],
            cells: [...l1.cells, ...l2.cells, ...forcedCells.map((fc) => fc.cell)],
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
export function findKissingLsResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findKissingLsHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // Kissing Ls finds forced cells when L-shaped regions touch.
  // We could emit AreaDeduction for L-shaped regions,
  // but the technique is pattern-specific and primarily produces hints directly.

  return { type: 'none' };
}

interface ForcedCell {
  cell: Coords;
  kind: 'place-star' | 'place-cross';
}

/**
 * Analyze a pair of kissing L-shapes to find forced cells
 */
function analyzeKissingLs(
  state: PuzzleState,
  l1: ReturnType<typeof findLShapes>[0],
  l2: ReturnType<typeof findLShapes>[0]
): ForcedCell[] {
  const forcedCells: ForcedCell[] = [];

  // Find the touching point(s) between the two Ls
  const touchingCells: Array<{ c1: Coords; c2: Coords }> = [];
  for (const c1 of l1.cells) {
    for (const c2 of l2.cells) {
      if (areAdjacent(c1, c2)) {
        touchingCells.push({ c1, c2 });
      }
    }
  }
  
  if (touchingCells.length === 0) return [];
  
  // Analyze the configuration based on where the Ls touch
  // Key insight: When two Ls kiss, certain cells in each L become forced
  // based on the need to place 2 stars in each L while respecting adjacency
  
  // Strategy: Look for cells in one L that, if they contained a star,
  // would make it impossible to place 2 stars in the other L
  
  // Check each empty cell in L1
  const l1Empties = emptyCells(state, l1.cells);
  const l2Empties = emptyCells(state, l2.cells);
  const viableL1Empties = l1Empties.filter(
    (cell) =>
      isValidStarPlacement(state, cell) &&
      canPlaceAllStarsSimultaneously(state, [cell], state.def.starsPerUnit) !== null
  );
  const viableL2Empties = l2Empties.filter(
    (cell) =>
      isValidStarPlacement(state, cell) &&
      canPlaceAllStarsSimultaneously(state, [cell], state.def.starsPerUnit) !== null
  );
  for (const cell of viableL1Empties) {
    // Count how many cells in L2 would be blocked if we place a star here
    const blockedInL2 = viableL2Empties.filter((c2) => {
      return areAdjacent(cell, c2);
    });

    // If placing a star here would block too many cells in L2,
    // making it impossible for L2 to get 2 stars, this cell must be a cross
    if (viableL2Empties.length - blockedInL2.length < 2) {
      forcedCells.push({ cell, kind: 'place-cross' });
    }
  }

  // Check each empty cell in L2
  for (const cell of viableL2Empties) {
    // Count how many cells in L1 would be blocked if we place a star here
    const blockedInL1 = viableL1Empties.filter((c1) => {
      return areAdjacent(cell, c1);
    });

    // If placing a star here would block too many cells in L1,
    // making it impossible for L1 to get 2 stars, this cell must be a cross
    if (viableL1Empties.length - blockedInL1.length < 2) {
      forcedCells.push({ cell, kind: 'place-cross' });
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
