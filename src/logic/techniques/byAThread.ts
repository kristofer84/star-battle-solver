import type { PuzzleState, Coords, CellState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { emptyCells, getCell } from '../helpers';
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

  // Find all empty cells
  const allCells: Coords[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      allCells.push({ row: r, col: c });
    }
  }
  const empties = emptyCells(state, allCells);

  // If no empty cells, puzzle is complete
  if (empties.length === 0) return null;

  // For each empty cell, test both hypotheses
  for (const cell of empties) {
    const result = testCellHypotheses(state, cell);
    
    if (result) {
      const { forcedValue, explanation, involvedUnits } = result;
      
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
  // Create a copy of the state for testing
  const testStateStar = cloneState(state);
  const testStateCross = cloneState(state);

  // Apply hypotheses
  testStateStar.cells[cell.row][cell.col] = 'star';
  testStateCross.cells[cell.row][cell.col] = 'cross';

  // Count solutions for each hypothesis
  // Use a low maxCount to detect multiple solutions quickly
  const starResult = countSolutions(testStateStar, {
    maxCount: 2,
    timeoutMs: 2000,
    maxDepth: 100,
  });

  const crossResult = countSolutions(testStateCross, {
    maxCount: 2,
    timeoutMs: 2000,
    maxDepth: 100,
  });

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
  const cellRef = `(${cell.row + 1}, ${cell.col + 1})`;
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
