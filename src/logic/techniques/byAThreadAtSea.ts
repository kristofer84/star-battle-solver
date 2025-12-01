import type { PuzzleState, Coords, CellState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { 
  emptyCells, 
  rowCells, 
  colCells, 
  regionCells, 
  countStars 
} from '../helpers';
import { countSolutions } from '../search';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `by-a-thread-at-sea-${hintCounter}`;
}

/**
 * By a Thread at Sea technique:
 * 
 * Combines uniqueness and isolation logic to determine forced moves.
 * This technique applies when a cell requires BOTH:
 * 1. Uniqueness reasoning (one hypothesis breaks solution uniqueness)
 * 2. Isolation reasoning (the cell is critical for isolated units)
 * 
 * This is more powerful than either technique alone, as it can solve
 * puzzles where neither by-a-thread nor at-sea would succeed independently.
 * 
 * Requirements: 15.1, 15.3
 */
export function findByAThreadAtSeaHint(state: PuzzleState): Hint | null {
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

  // For each empty cell, check if it requires both uniqueness and isolation
  for (const cell of empties) {
    // First check if the cell is in an isolated context
    const isolationContext = checkIsolationContext(state, cell);
    
    if (!isolationContext) {
      // No isolation, skip this cell
      continue;
    }

    // Now check if uniqueness reasoning applies
    const uniquenessResult = testCellUniqueness(state, cell);
    
    if (!uniquenessResult) {
      // No uniqueness forcing, skip this cell
      continue;
    }

    // Both isolation and uniqueness apply!
    const { forcedValue, uniquenessExplanation, involvedUnits } = uniquenessResult;
    
    return {
      id: nextHintId(),
      kind: forcedValue === 'star' ? 'place-star' : 'place-cross',
      technique: 'by-a-thread-at-sea',
      resultCells: [cell],
      explanation: buildCombinedExplanation(
        cell,
        forcedValue,
        isolationContext,
        uniquenessExplanation
      ),
      highlights: {
        cells: [cell, ...isolationContext.isolatedCells],
        ...involvedUnits,
      },
    };
  }

  return null;
}

interface IsolationContext {
  isolatedCells: Coords[];
  isolatedUnits: {
    rows: number[];
    cols: number[];
    regions: number[];
  };
  description: string;
}

interface UniquenessResult {
  forcedValue: 'star' | 'cross';
  uniquenessExplanation: string;
  involvedUnits: {
    rows?: number[];
    cols?: number[];
    regions?: number[];
  };
}

/**
 * Check if a cell is in an isolated context (at sea)
 * Returns isolation context if the cell is critical for isolated units
 */
function checkIsolationContext(
  state: PuzzleState,
  cell: Coords
): IsolationContext | null {
  const { starsPerUnit } = state.def;
  const isolatedCells: Coords[] = [];
  const isolatedUnits = { rows: [] as number[], cols: [] as number[], regions: [] as number[] };
  
  // Check if the cell is critical for its row
  const rowCellsList = rowCells(state, cell.row);
  const rowStars = countStars(state, rowCellsList);
  const rowRemaining = starsPerUnit - rowStars;
  const rowEmpties = emptyCells(state, rowCellsList);
  
  if (rowRemaining > 0 && rowEmpties.length === rowRemaining) {
    // Row is isolated - all empties must be stars
    isolatedCells.push(...rowEmpties);
    isolatedUnits.rows.push(cell.row);
  }
  
  // Check if the cell is critical for its column
  const colCellsList = colCells(state, cell.col);
  const colStars = countStars(state, colCellsList);
  const colRemaining = starsPerUnit - colStars;
  const colEmpties = emptyCells(state, colCellsList);
  
  if (colRemaining > 0 && colEmpties.length === colRemaining) {
    // Column is isolated - all empties must be stars
    isolatedCells.push(...colEmpties);
    isolatedUnits.cols.push(cell.col);
  }
  
  // Check if the cell is critical for its region
  const regionId = state.def.regions[cell.row][cell.col];
  const regionCellsList = regionCells(state, regionId);
  const regionStars = countStars(state, regionCellsList);
  const regionRemaining = starsPerUnit - regionStars;
  const regionEmpties = emptyCells(state, regionCellsList);
  
  if (regionRemaining > 0 && regionEmpties.length === regionRemaining) {
    // Region is isolated - all empties must be stars
    isolatedCells.push(...regionEmpties);
    isolatedUnits.regions.push(regionId);
  }
  
  // If no isolation found, return null
  if (isolatedCells.length === 0) {
    return null;
  }
  
  // Build description of isolation
  const unitDescriptions: string[] = [];
  if (isolatedUnits.rows.length > 0) {
    unitDescriptions.push(`row ${isolatedUnits.rows[0] + 1}`);
  }
  if (isolatedUnits.cols.length > 0) {
    unitDescriptions.push(`column ${isolatedUnits.cols[0] + 1}`);
  }
  if (isolatedUnits.regions.length > 0) {
    unitDescriptions.push(`region ${isolatedUnits.regions[0]}`);
  }
  
  return {
    isolatedCells,
    isolatedUnits,
    description: unitDescriptions.join(', '),
  };
}

/**
 * Test both hypotheses (star and cross) for a cell using uniqueness logic
 * Returns forced value if one hypothesis breaks uniqueness
 */
function testCellUniqueness(
  state: PuzzleState,
  cell: Coords
): UniquenessResult | null {
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
    const explanation = buildUniquenessExplanation(
      cell,
      'star',
      crossResult.count
    );
    
    return {
      forcedValue: 'star',
      uniquenessExplanation: explanation,
      involvedUnits: getInvolvedUnits(state, cell),
    };
  }

  if (crossUnique && !starUnique) {
    // Cross hypothesis preserves uniqueness, star breaks it
    const explanation = buildUniquenessExplanation(
      cell,
      'cross',
      starResult.count
    );
    
    return {
      forcedValue: 'cross',
      uniquenessExplanation: explanation,
      involvedUnits: getInvolvedUnits(state, cell),
    };
  }

  // Neither hypothesis provides a unique forcing
  return null;
}

/**
 * Build explanation combining both uniqueness and isolation reasoning
 */
function buildCombinedExplanation(
  cell: Coords,
  forcedValue: 'star' | 'cross',
  isolationContext: IsolationContext,
  uniquenessExplanation: string
): string {
  const cellRef = `(${cell.row + 1}, ${cell.col + 1})`;
  
  return `By a thread at sea: Cell ${cellRef} is in isolation at ${isolationContext.description}, ` +
         `and by uniqueness reasoning, it must be a ${forcedValue}. ${uniquenessExplanation}`;
}

/**
 * Build explanation for the uniqueness component
 */
function buildUniquenessExplanation(
  cell: Coords,
  forcedValue: 'star' | 'cross',
  otherCount: number
): string {
  const opposite = forcedValue === 'star' ? 'cross' : 'star';
  
  if (otherCount === 0) {
    return `Placing a ${opposite} leads to no valid solutions.`;
  } else {
    return `Placing a ${opposite} leads to multiple solutions.`;
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
