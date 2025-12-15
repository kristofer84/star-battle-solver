import type { PuzzleState, Coords } from '../types/puzzle';
import type { Hint } from '../types/hints';
import type {
  Deduction,
  CellDeduction,
  AreaDeduction,
  BlockDeduction,
  ExclusiveSetDeduction,
  AreaRelationDeduction,
} from '../types/deductions';
import {
  rowCells,
  colCells,
  regionCells,
  emptyCells,
  countStars,
  idToLetter,
} from './helpers';
import {
  filterValidDeductions,
  extractCellDeductions,
  cellsEqual,
} from './deductionUtils';
import { validateState } from './validation';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `main-solver-${hintCounter}`;
}


/**
 * Analyze collected deductions and find a clear hint (100% certain)
 * Returns null if no clear hint can be made
 */
export function analyzeDeductions(
  deductions: Deduction[],
  state: PuzzleState
): Hint | null {
  // Filter out invalid deductions
  const validDeductions = filterValidDeductions(deductions, state);

  // Strategy 1: Cell-level resolution
  const cellHint = resolveCellDeductions(validDeductions, state);
  if (cellHint) return cellHint;

  // Strategy 2: Area narrowing
  const areaHint = resolveAreaDeductions(validDeductions, state);
  if (areaHint) return areaHint;

  // Strategy 3: Block resolution
  const blockHint = resolveBlockDeductions(validDeductions, state);
  if (blockHint) return blockHint;

  // Strategy 4: Exclusive set resolution
  const exclusiveHint = resolveExclusiveSetDeductions(validDeductions, state);
  if (exclusiveHint) return exclusiveHint;

  // Strategy 5: Bounds resolution (upgrade bounds to exact counts)
  const boundsHint = resolveBoundsDeductions(validDeductions, state);
  if (boundsHint) return boundsHint;

  // Strategy 6: Area relation resolution
  const relationHint = resolveAreaRelationDeductions(validDeductions, state);
  if (relationHint) return relationHint;

  // Strategy 7: Cross-constraint resolution
  const crossHint = resolveCrossConstraints(validDeductions, state);
  if (crossHint) return crossHint;

  return null;
}

/**
 * Strategy 1: Resolve cell-level deductions
 * If multiple deductions point to the same cell, create a hint
 */
function resolveCellDeductions(
  deductions: Deduction[],
  state: PuzzleState
): Hint | null {
  const cellDeductions = extractCellDeductions(deductions);
  const cellMap = new Map<string, CellDeduction>();

  for (const ded of cellDeductions) {
    const key = `${ded.cell.row},${ded.cell.col}`;
    const existing = cellMap.get(key);

    if (existing) {
      // Check for conflicts
      if (existing.type !== ded.type) {
        // Conflict: same cell forced to both star and empty
        console.error(
          `[MAIN SOLVER] Conflict: cell (${ded.cell.row},${ded.cell.col}) forced to both ${existing.type} and ${ded.type}`
        );
        return null;
      }
      // Same deduction, keep existing
    } else {
      cellMap.set(key, ded);
    }
  }

  // Group by type
  const stars: Coords[] = [];
  const crosses: Coords[] = [];
  const techniques = new Set<string>();

  for (const ded of cellMap.values()) {
    if (ded.type === 'forceStar') {
      stars.push(ded.cell);
    } else {
      crosses.push(ded.cell);
    }
    techniques.add(ded.technique);
  }

  if (stars.length === 0 && crosses.length === 0) {
    return null;
  }

  // Create hint with all cell deductions
  const resultCells: Coords[] = [];
  const schemaCellTypes = new Map<string, 'star' | 'cross'>();

  for (const cell of stars) {
    if (state.cells[cell.row][cell.col] === 'empty') {
      resultCells.push(cell);
      schemaCellTypes.set(`${cell.row},${cell.col}`, 'star');
    }
  }

  for (const cell of crosses) {
    if (state.cells[cell.row][cell.col] === 'empty') {
      resultCells.push(cell);
      schemaCellTypes.set(`${cell.row},${cell.col}`, 'cross');
    }
  }

  if (resultCells.length === 0) {
    return null;
  }

  // Safety check: Don't create hints with too many cells
  // Large hints are likely errors or unverified deductions
  // Limit to a reasonable number (e.g., 10 cells max)
  const MAX_HINT_CELLS = 10;
  if (resultCells.length > MAX_HINT_CELLS) {
    console.warn(
      `[MAIN SOLVER] Too many cells in hint (${resultCells.length}), likely unverified deductions. Skipping.`
    );
    return null;
  }

  // Determine hint kind based on what we're actually placing
  // (not just what deductions exist, but what cells are actually empty)
  const placingStars = resultCells.some(cell => schemaCellTypes.get(`${cell.row},${cell.col}`) === 'star');
  const placingCrosses = resultCells.some(cell => schemaCellTypes.get(`${cell.row},${cell.col}`) === 'cross');
  
  const kind: 'place-star' | 'place-cross' =
    placingStars ? 'place-star' : 'place-cross';

  const explanation =
    techniques.size === 1
      ? `Combined deductions from ${Array.from(techniques)[0]} technique.`
      : `Combined deductions from ${techniques.size} techniques: ${Array.from(techniques).join(', ')}.`;

  // Validate that applying this hint won't create immediate conflicts
  // Check each result cell to ensure it's actually empty
  for (const cell of resultCells) {
    if (state.cells[cell.row][cell.col] !== 'empty') {
      // This should have been filtered out, but double-check
      console.error(
        `[MAIN SOLVER] Warning: Hint tries to place on non-empty cell (${cell.row},${cell.col}) which is ${state.cells[cell.row][cell.col]}`
      );
      return null;
    }
  }

  // Validate that applying this hint won't create validation errors
  // Create a test state with the hint applied
  const testState: PuzzleState = {
    ...state,
    cells: state.cells.map(row => [...row]),
  };
  
  for (const cell of resultCells) {
    const targetValue = schemaCellTypes.get(`${cell.row},${cell.col}`) === 'star' ? 'star' : 'cross';
    testState.cells[cell.row][cell.col] = targetValue;
  }
  
  const validationErrors = validateState(testState);
  if (validationErrors.length > 0) {
    console.error(
      `[MAIN SOLVER] Warning: Hint would create validation errors: ${validationErrors.join('; ')}`
    );
    return null;
  }

  return {
    id: nextHintId(),
    kind,
    technique: Array.from(techniques)[0] as any, // Use first technique as primary
    resultCells,
    explanation,
    schemaCellTypes: placingStars && placingCrosses ? schemaCellTypes : undefined,
  };
}

/**
 * Strategy 2: Resolve area deductions
 * If an area deduction has only one candidate cell left, create a cell deduction
 */
function resolveAreaDeductions(
  deductions: Deduction[],
  state: PuzzleState
): Hint | null {
  const areaDeductions = deductions.filter(
    (d): d is AreaDeduction => d.kind === 'area'
  );

  for (const ded of areaDeductions) {
    // Filter candidate cells to only empty ones
    const emptyCandidates = ded.candidateCells.filter(
      (c) => state.cells[c.row][c.col] === 'empty'
    );

    // Count current stars in area
    let currentStars = 0;
    let totalCells: Coords[] = [];

    if (ded.areaType === 'row') {
      totalCells = rowCells(state, ded.areaId);
      currentStars = countStars(state, totalCells);
    } else if (ded.areaType === 'column') {
      totalCells = colCells(state, ded.areaId);
      currentStars = countStars(state, totalCells);
    } else {
      // region
      totalCells = regionCells(state, ded.areaId);
      currentStars = countStars(state, totalCells);
    }

    const starsPerUnit = state.def.starsPerUnit;
    const remainingStars = starsPerUnit - currentStars;

    // If exact requirement and only one candidate left
    if (
      ded.starsRequired !== undefined &&
      remainingStars === ded.starsRequired &&
      emptyCandidates.length === 1
    ) {
      // All remaining stars must be in this one cell
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: ded.technique,
        resultCells: emptyCandidates,
        explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} requires ${ded.starsRequired} more star(s), and only one candidate cell remains.`}`,
      };
    }

    // If maxStars is 0 and there are candidates, they must all be crosses
    if (ded.maxStars === 0 && emptyCandidates.length > 0) {
      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: ded.technique,
        resultCells: emptyCandidates,
        explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} cannot have any more stars.`}`,
      };
    }

    // If minStars equals remainingStars and there's only one candidate
    if (
      ded.minStars !== undefined &&
      remainingStars === ded.minStars &&
      emptyCandidates.length === 1
    ) {
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: ded.technique,
        resultCells: emptyCandidates,
        explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} requires at least ${ded.minStars} more star(s), and only one candidate cell remains.`}`,
      };
    }
  }

  return null;
}

/**
 * Strategy 3: Resolve block deductions
 * If a block deduction + cell eliminations leave only one possibility, create a hint
 */
function resolveBlockDeductions(
  deductions: Deduction[],
  state: PuzzleState
): Hint | null {
  const blockDeductions = deductions.filter(
    (d): d is BlockDeduction => d.kind === 'block'
  );
  const cellDeductions = extractCellDeductions(deductions);

  // Create a set of cells that are forced empty
  const forcedEmpty = new Set<string>();
  for (const ded of cellDeductions) {
    if (ded.type === 'forceEmpty') {
      forcedEmpty.add(`${ded.cell.row},${ded.cell.col}`);
    }
  }

  for (const ded of blockDeductions) {
    // For square-counting, bRow/bCol are already cell coordinates
    // For other techniques (like two-by-two), they're grid coordinates that need to be multiplied by 2
    let baseRow: number;
    let baseCol: number;
    if (ded.technique === 'square-counting') {
      baseRow = ded.block.bRow;
      baseCol = ded.block.bCol;
    } else {
      baseRow = 2 * ded.block.bRow;
      baseCol = 2 * ded.block.bCol;
    }
    const blockCells: Coords[] = [
      { row: baseRow, col: baseCol },
      { row: baseRow, col: baseCol + 1 },
      { row: baseRow + 1, col: baseCol },
      { row: baseRow + 1, col: baseCol + 1 },
    ];

    const emptyBlockCells = blockCells.filter(
      (c) => state.cells[c.row][c.col] === 'empty'
    );

    // Count stars already in block
    const currentStars = blockCells.filter(
      (c) => state.cells[c.row][c.col] === 'star'
    ).length;

    // If exact requirement and only one empty cell left
    if (
      ded.starsRequired !== undefined &&
      ded.starsRequired > currentStars &&
      emptyBlockCells.length === 1
    ) {
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: ded.technique,
        resultCells: emptyBlockCells,
        explanation: `${ded.explanation || `Block (${ded.block.bRow},${ded.block.bCol}) requires ${ded.starsRequired} star(s), and only one empty cell remains.`}`,
      };
    }

    // If maxStars is 0 and there are empty cells, they must be crosses
    if (ded.maxStars === 0 && emptyBlockCells.length > 0) {
      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: ded.technique,
        resultCells: emptyBlockCells,
        explanation: `${ded.explanation || `Block (${ded.block.bRow},${ded.block.bCol}) cannot have any stars.`}`,
      };
    }

    // If maxStars is 1 and we already have 1 star, remaining must be crosses
    if (ded.maxStars === 1 && currentStars === 1 && emptyBlockCells.length > 0) {
      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: ded.technique,
        resultCells: emptyBlockCells,
        explanation: `${ded.explanation || `Block (${ded.block.bRow},${ded.block.bCol}) can have at most 1 star, and already has 1.`}`,
      };
    }
  }

  return null;
}

/**
 * Strategy 4: Resolve exclusive set deductions
 * If an exclusive set has only one valid cell, create a hint
 */
function resolveExclusiveSetDeductions(
  deductions: Deduction[],
  state: PuzzleState
): Hint | null {
  const exclusiveDeductions = deductions.filter(
    (d): d is ExclusiveSetDeduction => d.kind === 'exclusive-set'
  );

  for (const ded of exclusiveDeductions) {
    const emptyCells = ded.cells.filter(
      (c) => state.cells[c.row][c.col] === 'empty'
    );
    const currentStars = ded.cells.filter(
      (c) => state.cells[c.row][c.col] === 'star'
    ).length;

    const remainingStars = ded.starsRequired - currentStars;

    // If only one empty cell left and we need one more star
    if (remainingStars === 1 && emptyCells.length === 1) {
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: ded.technique,
        resultCells: emptyCells,
        explanation: `${ded.explanation || `Exclusive set requires ${ded.starsRequired} star(s), and only one candidate cell remains.`}`,
      };
    }

    // If we have enough stars, remaining cells must be crosses
    if (currentStars === ded.starsRequired && emptyCells.length > 0) {
      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: ded.technique,
        resultCells: emptyCells,
        explanation: `${ded.explanation || `Exclusive set already has ${ded.starsRequired} star(s).`}`,
      };
    }
  }

  return null;
}

/**
 * Strategy 5: Resolve bounds deductions
 * Upgrade bounds to exact counts when combined with global requirements
 */
function resolveBoundsDeductions(
  deductions: Deduction[],
  state: PuzzleState
): Hint | null {
  const areaDeductions = deductions.filter(
    (d): d is AreaDeduction => d.kind === 'area'
  );

  for (const ded of areaDeductions) {
    // Count current stars in area
    let currentStars = 0;
    let totalCells: Coords[] = [];

    if (ded.areaType === 'row') {
      totalCells = rowCells(state, ded.areaId);
      currentStars = countStars(state, totalCells);
    } else if (ded.areaType === 'column') {
      totalCells = colCells(state, ded.areaId);
      currentStars = countStars(state, totalCells);
    } else {
      // region
      totalCells = regionCells(state, ded.areaId);
      currentStars = countStars(state, totalCells);
    }

    const starsPerUnit = state.def.starsPerUnit;
    const remainingStars = starsPerUnit - currentStars;

    const emptyCandidates = ded.candidateCells.filter(
      (c) => state.cells[c.row][c.col] === 'empty'
    );

    // If minStars + remainingStars align to give exact count
    if (
      ded.minStars !== undefined &&
      ded.maxStars !== undefined &&
      ded.minStars === ded.maxStars &&
      ded.minStars === remainingStars &&
      emptyCandidates.length === ded.minStars
    ) {
      // All candidates must be stars
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: ded.technique,
        resultCells: emptyCandidates,
        explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} requires exactly ${ded.minStars} more star(s) in ${emptyCandidates.length} candidate cell(s).`}`,
      };
    }

    // If minStars equals remainingStars and equals number of candidates
    if (
      ded.minStars !== undefined &&
      ded.minStars === remainingStars &&
      emptyCandidates.length === ded.minStars
    ) {
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: ded.technique,
        resultCells: emptyCandidates,
        explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} requires at least ${ded.minStars} more star(s) in ${emptyCandidates.length} candidate cell(s).`}`,
      };
    }
  }

  return null;
}

/**
 * Strategy 6: Resolve area relation deductions
 * Use area relations + individual area constraints to narrow possibilities
 */
function resolveAreaRelationDeductions(
  deductions: Deduction[],
  state: PuzzleState
): Hint | null {
  const relationDeductions = deductions.filter(
    (d): d is AreaRelationDeduction => d.kind === 'area-relation'
  );
  const areaDeductions = deductions.filter(
    (d): d is AreaDeduction => d.kind === 'area'
  );

  // For each relation, check if we can narrow down candidates
  for (const relation of relationDeductions) {
    // Count current stars across all areas in relation
    let totalCurrentStars = 0;
    for (const area of relation.areas) {
      let currentStars = 0;
      if (area.areaType === 'row') {
        currentStars = countStars(state, rowCells(state, area.areaId));
      } else if (area.areaType === 'column') {
        currentStars = countStars(state, colCells(state, area.areaId));
      } else {
        currentStars = countStars(state, regionCells(state, area.areaId));
      }
      totalCurrentStars += currentStars;
    }

    const remainingStars = relation.totalStars - totalCurrentStars;

    // If only one candidate cell across all areas and we need one star
    const allCandidates: Coords[] = [];
    for (const area of relation.areas) {
      const emptyCandidates = area.candidateCells.filter(
        (c) => state.cells[c.row][c.col] === 'empty'
      );
      allCandidates.push(...emptyCandidates);
    }

    if (remainingStars === 1 && allCandidates.length === 1) {
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: relation.technique,
        resultCells: allCandidates,
        explanation: `${relation.explanation || `Area relation requires ${relation.totalStars} total stars, and only one candidate cell remains across all areas.`}`,
      };
    }
  }

  return null;
}

/**
 * Strategy 7: Cross-constraint resolution
 * Combine different deduction types to narrow possibilities
 */
function resolveCrossConstraints(
  deductions: Deduction[],
  state: PuzzleState
): Hint | null {
  // Example: If an area deduction says "at least 1 star in these cells"
  // and an exclusive set includes those cells with "exactly 1 star",
  // we can narrow down

  const areaDeductions = deductions.filter(
    (d): d is AreaDeduction => d.kind === 'area'
  );
  const exclusiveDeductions = deductions.filter(
    (d): d is ExclusiveSetDeduction => d.kind === 'exclusive-set'
  );

  // Check if an exclusive set overlaps with an area's candidates
  for (const area of areaDeductions) {
    const emptyCandidates = area.candidateCells.filter(
      (c) => state.cells[c.row][c.col] === 'empty'
    );

    for (const exclusive of exclusiveDeductions) {
      const emptyExclusive = exclusive.cells.filter(
        (c) => state.cells[c.row][c.col] === 'empty'
      );

      // Check if exclusive set is a subset of area candidates
      const isSubset = emptyExclusive.every((exc) =>
        emptyCandidates.some((area) => cellsEqual(exc, area))
      );

      if (isSubset && emptyExclusive.length === exclusive.starsRequired) {
        // The exclusive set must contain all stars for this area
        // If there's only one cell in the exclusive set, it must be a star
        if (emptyExclusive.length === 1) {
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: exclusive.technique,
            resultCells: emptyExclusive,
            explanation: `${exclusive.explanation || `Exclusive set within area requires exactly ${exclusive.starsRequired} star(s) in one candidate cell.`}`,
          };
        }
      }
    }
  }

  return null;
}

