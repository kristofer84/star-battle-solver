import type { PuzzleState, Coords, CellState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { emptyCells, getCell, neighbors8 } from '../helpers';
import { countSolutions } from '../search';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `by-a-thread-${hintCounter}`;
}

/**
 * By a Thread technique:
 * 
 * Uses solution uniqueness to determine forced moves. For each empty cell,
 * tests both hypotheses (star vs cross). If one hypothesis leads to 0 or
 * multiple solutions while the other leads to exactly 1 solution, the cell
 * is forced to the value that preserves uniqueness.
 * 
 * This is a uniqueness technique that assumes the puzzle has exactly one solution.
 * 
 * Requirements: 13.1, 13.2, 13.4
 */
export function findByAThreadHint(state: PuzzleState): Hint | null {
  const { size } = state.def;
  const startTime = performance.now();
  const MAX_TOTAL_TIME_MS = 2000; // Don't spend more than 2 seconds total

  // Find all empty cells
  const allCells: Coords[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      allCells.push({ row: r, col: c });
    }
  }
  const empties = emptyCells(state, allCells);

  console.log(`[DEBUG] By a Thread: Starting with ${empties.length} empty cells`);

  // If no empty cells, puzzle is complete
  if (empties.length === 0) return null;

  // Limit the number of cells to check to prevent freeze
  const MAX_CELLS_TO_CHECK = 5; // Reduced from 20 - this technique is very expensive
  const cellsToCheck = empties.slice(0, MAX_CELLS_TO_CHECK);
  
  if (empties.length > MAX_CELLS_TO_CHECK) {
    console.log(`[DEBUG] By a Thread: Limiting to first ${MAX_CELLS_TO_CHECK} cells (out of ${empties.length})`);
  }

  // For each empty cell, test both hypotheses
  for (let i = 0; i < cellsToCheck.length; i++) {
    const cell = cellsToCheck[i];
    
    // Check if we're running out of time
    const elapsed = performance.now() - startTime;
    if (elapsed > MAX_TOTAL_TIME_MS) {
      console.warn(`[PERF] By a Thread: Exiting early after ${elapsed.toFixed(2)}ms (checked ${i}/${cellsToCheck.length} cells)`);
      return null;
    }
    
    if (i % 5 === 0) {
      console.log(`[DEBUG] By a Thread: Testing cell ${i + 1}/${cellsToCheck.length} (${cell.row}, ${cell.col})`);
    }
    
    const result = testCellHypotheses(state, cell);
    
    if (result) {
      const { forcedValue, explanation, involvedUnits } = result;
      
      // Before returning a hint to place a star, verify it won't violate basic constraints
      if (forcedValue === 'star') {
        // Check if placing a star here would be adjacent to existing stars
        const nbs = neighbors8(cell, size);
        const hasAdjacentStar = nbs.some(nb => getCell(state, nb) === 'star');
        if (hasAdjacentStar) {
          // This would violate adjacency - skip this hint
          continue;
        }
      }
      
      return {
        id: nextHintId(),
        kind: forcedValue === 'star' ? 'place-star' : 'place-cross',
        technique: 'by-a-thread',
        resultCells: [cell],
        explanation,
        highlights: {
          cells: [cell],
          ...involvedUnits,
        },
      };
    }
  }

  const totalTime = performance.now() - startTime;
  console.log(`[DEBUG] By a Thread: Completed in ${totalTime.toFixed(2)}ms (checked ${cellsToCheck.length} cells)`);

  return null;
}

interface HypothesisResult {
  forcedValue: 'star' | 'cross';
  explanation: string;
  involvedUnits: {
    rows?: number[];
    cols?: number[];
    regions?: number[];
  };
}

/**
 * Test both hypotheses (star and cross) for a cell.
 * Returns forced value if one hypothesis breaks uniqueness.
 */
function testCellHypotheses(
  state: PuzzleState,
  cell: Coords
): HypothesisResult | null {
  const startTime = performance.now();
  
  // Create a copy of the state for testing
  const testStateStar = cloneState(state);
  const testStateCross = cloneState(state);

  // Apply hypotheses
  testStateStar.cells[cell.row][cell.col] = 'star';
  testStateCross.cells[cell.row][cell.col] = 'cross';

  // Count solutions for each hypothesis
  // Use a low maxCount to detect multiple solutions quickly
  // Aggressively reduce timeout to prevent freeze
  const starStartTime = performance.now();
  const starResult = countSolutions(testStateStar, {
    maxCount: 2,
    timeoutMs: 300,  // Reduced from 1000ms - very aggressive
    maxDepth: 20,    // Reduced from 50 - very aggressive
  });
  const starTime = performance.now() - starStartTime;
  if (starTime > 200) {
    console.log(`[DEBUG] By a Thread: Star hypothesis took ${starTime.toFixed(2)}ms for cell (${cell.row}, ${cell.col})`);
  }

  const crossStartTime = performance.now();
  const crossResult = countSolutions(testStateCross, {
    maxCount: 2,
    timeoutMs: 300,  // Reduced from 1000ms - very aggressive
    maxDepth: 20,    // Reduced from 50 - very aggressive
  });
  const crossTime = performance.now() - crossStartTime;
  if (crossTime > 200) {
    console.log(`[DEBUG] By a Thread: Cross hypothesis took ${crossTime.toFixed(2)}ms for cell (${cell.row}, ${cell.col})`);
  }
  
  const totalTime = performance.now() - startTime;
  if (totalTime > 500) {
    console.warn(`[PERF] By a Thread: testCellHypotheses took ${totalTime.toFixed(2)}ms for cell (${cell.row}, ${cell.col})`);
  }

  // If either hypothesis timed out, we can't make a determination
  if (starResult.timedOut || crossResult.timedOut) {
    return null;
  }

  // Check if one hypothesis leads to exactly 1 solution and the other doesn't
  const starUnique = starResult.count === 1;
  const crossUnique = crossResult.count === 1;

  if (starUnique && !crossUnique) {
    // Star hypothesis preserves uniqueness, cross breaks it
    const explanation = buildExplanation(
      cell,
      'star',
      crossResult.count,
      state
    );
    
    return {
      forcedValue: 'star',
      explanation,
      involvedUnits: getInvolvedUnits(state, cell),
    };
  }

  if (crossUnique && !starUnique) {
    // Cross hypothesis preserves uniqueness, star breaks it
    const explanation = buildExplanation(
      cell,
      'cross',
      starResult.count,
      state
    );
    
    return {
      forcedValue: 'cross',
      explanation,
      involvedUnits: getInvolvedUnits(state, cell),
    };
  }

  // Neither hypothesis provides a unique forcing
  return null;
}

/**
 * Build explanation for the uniqueness argument
 */
function buildExplanation(
  cell: Coords,
  forcedValue: 'star' | 'cross',
  otherCount: number,
  state: PuzzleState
): string {
  const cellRef = `(${cell.row}, ${cell.col})`;
  const opposite = forcedValue === 'star' ? 'cross' : 'star';
  
  if (otherCount === 0) {
    return `By uniqueness: placing a ${opposite} at ${cellRef} leads to no valid solutions, so it must be a ${forcedValue}.`;
  } else {
    return `By uniqueness: placing a ${opposite} at ${cellRef} leads to multiple solutions, so it must be a ${forcedValue} to preserve the unique solution.`;
  }
}

/**
 * Get the units (row, col, region) involved in this cell
 */
function getInvolvedUnits(
  state: PuzzleState,
  cell: Coords
): { rows: number[]; cols: number[]; regions: number[] } {
  const regionId = state.def.regions[cell.row][cell.col];
  
  return {
    rows: [cell.row],
    cols: [cell.col],
    regions: [regionId],
  };
}

/**
 * Clone a puzzle state for hypothesis testing
 */
function cloneState(state: PuzzleState): PuzzleState {
  return {
    def: state.def,
    cells: state.cells.map(row => [...row]),
  };
}
