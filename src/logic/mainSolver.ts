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

export interface MainSolverAnalysisResult {
  hint: Hint | null;
  validDeductions: Deduction[];
  supportingDeductions: Deduction[];
}

interface MainSolverHintResult {
  hint: Hint;
  supportingDeductions: Deduction[];
}

/**
 * Analyze collected deductions and find a clear hint (100% certain)
 * Returns null if no clear hint can be made
 */
export function analyzeDeductions(
  deductions: Deduction[],
  state: PuzzleState
): Hint | null {
  return analyzeDeductionsWithContext(deductions, state).hint;
}

function mergeHintHighlights(a?: Hint['highlights'], b?: Hint['highlights']): Hint['highlights'] | undefined {
  if (!a && !b) return undefined;
  const merged: Hint['highlights'] = {
    cells: [],
    rows: [],
    cols: [],
    regions: [],
  };

  function addUnique<T>(target: T[], values?: T[]) {
    if (!values) return;
    for (const v of values) {
      if (!target.includes(v)) target.push(v);
    }
  }

  addUnique(merged.cells!, a?.cells);
  addUnique(merged.cells!, b?.cells);
  addUnique(merged.rows!, a?.rows);
  addUnique(merged.rows!, b?.rows);
  addUnique(merged.cols!, a?.cols);
  addUnique(merged.cols!, b?.cols);
  addUnique(merged.regions!, a?.regions);
  addUnique(merged.regions!, b?.regions);

  // Trim empty arrays to keep payload small / semantics clear.
  if (merged.cells?.length === 0) delete merged.cells;
  if (merged.rows?.length === 0) delete merged.rows;
  if (merged.cols?.length === 0) delete merged.cols;
  if (merged.regions?.length === 0) delete merged.regions;

  return merged;
}

function deductionToHighlight(ded: Deduction, state: PuzzleState): Required<Hint['highlights']> {
  const out: Required<Hint['highlights']> = {
    cells: [],
    rows: [],
    cols: [],
    regions: [],
  };

  function addCell(cell: Coords) {
    out.cells.push(cell);
    if (cell.row >= 0 && cell.row < state.def.size) out.rows.push(cell.row);
    if (cell.col >= 0 && cell.col < state.def.size) out.cols.push(cell.col);
    const regionId = state.def.regions[cell.row]?.[cell.col];
    if (regionId !== undefined) out.regions.push(regionId);
  }

  function addCells(cells: Coords[]) {
    for (const c of cells) addCell(c);
  }

  switch (ded.kind) {
    case 'cell': {
      addCell(ded.cell);
      break;
    }
    case 'block': {
      const baseRow = ded.technique === 'square-counting' ? ded.block.bRow : 2 * ded.block.bRow;
      const baseCol = ded.technique === 'square-counting' ? ded.block.bCol : 2 * ded.block.bCol;
      addCells([
        { row: baseRow, col: baseCol },
        { row: baseRow, col: baseCol + 1 },
        { row: baseRow + 1, col: baseCol },
        { row: baseRow + 1, col: baseCol + 1 },
      ]);
      break;
    }
    case 'area': {
      if (ded.areaType === 'row') out.rows.push(ded.areaId);
      if (ded.areaType === 'column') out.cols.push(ded.areaId);
      if (ded.areaType === 'region') out.regions.push(ded.areaId);
      addCells(ded.candidateCells);
      break;
    }
    case 'exclusive-set': {
      addCells(ded.cells);
      break;
    }
    case 'area-relation': {
      for (const area of ded.areas) {
        if (area.areaType === 'row') out.rows.push(area.areaId);
        if (area.areaType === 'column') out.cols.push(area.areaId);
        if (area.areaType === 'region') out.regions.push(area.areaId);
        addCells(area.candidateCells);
      }
      break;
    }
  }

  // Deduplicate primitives.
  out.rows = Array.from(new Set(out.rows));
  out.cols = Array.from(new Set(out.cols));
  out.regions = Array.from(new Set(out.regions));
  // Dedup cells by key.
  const seen = new Set<string>();
  out.cells = out.cells.filter((c) => {
    const key = `${c.row},${c.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return out;
}

function buildSupportingHighlights(deductions: Deduction[], state: PuzzleState): Hint['highlights'] | undefined {
  if (deductions.length === 0) return undefined;

  const merged: Required<Hint['highlights']> = {
    cells: [],
    rows: [],
    cols: [],
    regions: [],
  };

  for (const d of deductions) {
    const h = deductionToHighlight(d, state);
    merged.cells.push(...h.cells);
    merged.rows.push(...h.rows);
    merged.cols.push(...h.cols);
    merged.regions.push(...h.regions);
  }

  // Deduplicate.
  merged.rows = Array.from(new Set(merged.rows));
  merged.cols = Array.from(new Set(merged.cols));
  merged.regions = Array.from(new Set(merged.regions));
  const seenCells = new Set<string>();
  merged.cells = merged.cells.filter((c) => {
    const key = `${c.row},${c.col}`;
    if (seenCells.has(key)) return false;
    seenCells.add(key);
    return true;
  });

  // Trim empty arrays.
  const out: Hint['highlights'] = { ...merged };
  if (out.cells?.length === 0) delete out.cells;
  if (out.rows?.length === 0) delete out.rows;
  if (out.cols?.length === 0) delete out.cols;
  if (out.regions?.length === 0) delete out.regions;
  return out;
}

export function analyzeDeductionsWithContext(
  deductions: Deduction[],
  state: PuzzleState
): MainSolverAnalysisResult {
  // Filter out invalid deductions
  const validDeductions = filterValidDeductions(deductions, state);

  const cellHint = resolveCellDeductions(validDeductions, state);
  if (cellHint) {
    const supportingHighlights = buildSupportingHighlights(cellHint.supportingDeductions, state);
    cellHint.hint.highlights = mergeHintHighlights(cellHint.hint.highlights, supportingHighlights);
    return { hint: cellHint.hint, validDeductions, supportingDeductions: cellHint.supportingDeductions };
  }

  const areaHint = resolveAreaDeductions(validDeductions, state);
  if (areaHint) {
    const supportingHighlights = buildSupportingHighlights(areaHint.supportingDeductions, state);
    areaHint.hint.highlights = mergeHintHighlights(areaHint.hint.highlights, supportingHighlights);
    return { hint: areaHint.hint, validDeductions, supportingDeductions: areaHint.supportingDeductions };
  }

  const blockHint = resolveBlockDeductions(validDeductions, state);
  if (blockHint) {
    const supportingHighlights = buildSupportingHighlights(blockHint.supportingDeductions, state);
    blockHint.hint.highlights = mergeHintHighlights(blockHint.hint.highlights, supportingHighlights);
    return { hint: blockHint.hint, validDeductions, supportingDeductions: blockHint.supportingDeductions };
  }

  const exclusiveHint = resolveExclusiveSetDeductions(validDeductions, state);
  if (exclusiveHint) {
    const supportingHighlights = buildSupportingHighlights(exclusiveHint.supportingDeductions, state);
    exclusiveHint.hint.highlights = mergeHintHighlights(exclusiveHint.hint.highlights, supportingHighlights);
    return { hint: exclusiveHint.hint, validDeductions, supportingDeductions: exclusiveHint.supportingDeductions };
  }

  const boundsHint = resolveBoundsDeductions(validDeductions, state);
  if (boundsHint) {
    const supportingHighlights = buildSupportingHighlights(boundsHint.supportingDeductions, state);
    boundsHint.hint.highlights = mergeHintHighlights(boundsHint.hint.highlights, supportingHighlights);
    return { hint: boundsHint.hint, validDeductions, supportingDeductions: boundsHint.supportingDeductions };
  }

  const relationHint = resolveAreaRelationDeductions(validDeductions, state);
  if (relationHint) {
    const supportingHighlights = buildSupportingHighlights(relationHint.supportingDeductions, state);
    relationHint.hint.highlights = mergeHintHighlights(relationHint.hint.highlights, supportingHighlights);
    return { hint: relationHint.hint, validDeductions, supportingDeductions: relationHint.supportingDeductions };
  }

  const crossHint = resolveCrossConstraints(validDeductions, state);
  if (crossHint) {
    const supportingHighlights = buildSupportingHighlights(crossHint.supportingDeductions, state);
    crossHint.hint.highlights = mergeHintHighlights(crossHint.hint.highlights, supportingHighlights);
    return { hint: crossHint.hint, validDeductions, supportingDeductions: crossHint.supportingDeductions };
  }

  return { hint: null, validDeductions, supportingDeductions: [] };
}

/**
 * Strategy 1: Resolve cell-level deductions
 * If multiple deductions point to the same cell, create a hint
 */
function resolveCellDeductions(
  deductions: Deduction[],
  state: PuzzleState
): MainSolverHintResult | null {
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

  // Separate by type and keep technique info per cell
  const stars: Coords[] = [];
  const crosses: Coords[] = [];
  const techniqueByCell = new Map<string, string>();
  const techniques = new Set<string>();

  for (const ded of cellMap.values()) {
    const key = `${ded.cell.row},${ded.cell.col}`;
    techniqueByCell.set(key, ded.technique);
    techniques.add(ded.technique);

    if (ded.type === 'forceStar') {
      stars.push(ded.cell);
    } else {
      crosses.push(ded.cell);
    }
  }

  if (stars.length === 0 && crosses.length === 0) {
    return null;
  }

  // Only create hints for currently empty cells
  const starCells = stars.filter((c) => state.cells[c.row][c.col] === 'empty');
  const crossCells = crosses.filter((c) => state.cells[c.row][c.col] === 'empty');

  if (starCells.length === 0 && crossCells.length === 0) {
    return null;
  }

  const MAX_HINT_CELLS = 10;

  function tryMakeHint(
    resultCells: Coords[],
    schemaCellTypes: Map<string, 'star' | 'cross'>,
    hintTechniques: Set<string>,
    supportingDeductions: Deduction[]
  ): MainSolverHintResult | null {
    if (resultCells.length === 0) return null;

    // Safety: don't create huge hints
    if (resultCells.length > MAX_HINT_CELLS) return null;

    // Double-check target cells are empty
    for (const cell of resultCells) {
      if (state.cells[cell.row][cell.col] !== 'empty') return null;
    }

    const placingStars = resultCells.some(
      (cell) => schemaCellTypes.get(`${cell.row},${cell.col}`) === 'star'
    );
    const placingCrosses = resultCells.some(
      (cell) => schemaCellTypes.get(`${cell.row},${cell.col}`) === 'cross'
    );

    const kind: 'place-star' | 'place-cross' = placingStars
      ? 'place-star'
      : 'place-cross';

    // Build a human-readable explanation from the contributing techniques.
    const techniqueList = Array.from(hintTechniques);
    const primaryTechnique = techniqueList[0] ?? 'unknown';
    let explanation: string;
    if (hintTechniques.size === 1) {
      explanation = `The ${primaryTechnique} technique determines ${resultCells.length === 1 ? 'this cell' : 'these cells'}.`;
    } else {
      explanation = `Combining constraints from ${techniqueList.join(' and ')} narrows down ${resultCells.length === 1 ? 'this cell' : 'these cells'}.`;
    }

    // Apply to a test state and validate
    const testState: PuzzleState = {
      ...state,
      cells: state.cells.map((row) => [...row]),
    };

    for (const cell of resultCells) {
      const targetValue =
        schemaCellTypes.get(`${cell.row},${cell.col}`) === 'star'
          ? 'star'
          : 'cross';
      testState.cells[cell.row][cell.col] = targetValue;
    }

    const validationErrors = validateState(testState);
    if (validationErrors.length > 0) return null;

    return {
      hint: {
        id: nextHintId(),
        kind,
        technique: Array.from(hintTechniques)[0] as any, // primary technique
        resultCells,
        explanation,
        schemaCellTypes: placingStars && placingCrosses ? schemaCellTypes : undefined,
      },
      supportingDeductions,
    };
  }

  // 1) Prefer a single-cell hint (usually most useful).
  // Try stars first, then crosses.
  for (const cell of starCells) {
    const key = `${cell.row},${cell.col}`;
    const schemaCellTypes = new Map<string, 'star' | 'cross'>([[key, 'star']]);
    const hintTechniques = new Set<string>([techniqueByCell.get(key) || 'unknown']);
    const supporting = cellMap.get(key) ? [cellMap.get(key)!] : [];
    const hint = tryMakeHint([cell], schemaCellTypes, hintTechniques, supporting);
    if (hint) return hint;
  }
  for (const cell of crossCells) {
    const key = `${cell.row},${cell.col}`;
    const schemaCellTypes = new Map<string, 'star' | 'cross'>([[key, 'cross']]);
    const hintTechniques = new Set<string>([techniqueByCell.get(key) || 'unknown']);
    const supporting = cellMap.get(key) ? [cellMap.get(key)!] : [];
    const hint = tryMakeHint([cell], schemaCellTypes, hintTechniques, supporting);
    if (hint) return hint;
  }

  // 2) Fall back to a small bundle (kept under MAX_HINT_CELLS).
  const resultCells: Coords[] = [];
  const schemaCellTypes = new Map<string, 'star' | 'cross'>();
  const hintTechniques = new Set<string>();

  // Add stars first, then crosses, up to MAX_HINT_CELLS.
  const supportingDeductions: Deduction[] = [];
  for (const cell of starCells) {
    if (resultCells.length >= MAX_HINT_CELLS) break;
    const key = `${cell.row},${cell.col}`;
    resultCells.push(cell);
    schemaCellTypes.set(key, 'star');
    hintTechniques.add(techniqueByCell.get(key) || 'unknown');
    const ded = cellMap.get(key);
    if (ded) supportingDeductions.push(ded);
  }
  for (const cell of crossCells) {
    if (resultCells.length >= MAX_HINT_CELLS) break;
    const key = `${cell.row},${cell.col}`;
    resultCells.push(cell);
    schemaCellTypes.set(key, 'cross');
    hintTechniques.add(techniqueByCell.get(key) || 'unknown');
    const ded = cellMap.get(key);
    if (ded) supportingDeductions.push(ded);
  }

  return tryMakeHint(resultCells, schemaCellTypes, hintTechniques, supportingDeductions);
}

/**
 * Strategy 2: Resolve area deductions
 * If an area deduction has only one candidate cell left, create a cell deduction
 */
function resolveAreaDeductions(
  deductions: Deduction[],
  state: PuzzleState
): MainSolverHintResult | null {
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
        hint: {
          id: nextHintId(),
          kind: 'place-star',
          technique: ded.technique,
          resultCells: emptyCandidates,
          explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} requires ${ded.starsRequired} more star(s), and only one candidate cell remains.`}`,
          details: [],
        },
        supportingDeductions: [ded],
      };
    }

    // If maxStars is 0 and there are candidates, they must all be crosses
    if (ded.maxStars === 0 && emptyCandidates.length > 0) {
      return {
        hint: {
          id: nextHintId(),
          kind: 'place-cross',
          technique: ded.technique,
          resultCells: emptyCandidates,
          explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} cannot have any more stars.`}`,
          details: [],
        },
        supportingDeductions: [ded],
      };
    }

    // If minStars equals remainingStars and there's only one candidate
    if (
      ded.minStars !== undefined &&
      remainingStars === ded.minStars &&
      emptyCandidates.length === 1
    ) {
      return {
        hint: {
          id: nextHintId(),
          kind: 'place-star',
          technique: ded.technique,
          resultCells: emptyCandidates,
          explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} requires at least ${ded.minStars} more star(s), and only one candidate cell remains.`}`,
          details: [],
        },
        supportingDeductions: [ded],
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
): MainSolverHintResult | null {
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
        hint: {
          id: nextHintId(),
          kind: 'place-star',
          technique: ded.technique,
          resultCells: emptyBlockCells,
          explanation: `${ded.explanation || `Block (${ded.block.bRow},${ded.block.bCol}) requires ${ded.starsRequired} star(s), and only one empty cell remains.`}`,
          details: [],
        },
        supportingDeductions: [ded],
      };
    }

    // If maxStars is 0 and there are empty cells, they must be crosses
    if (ded.maxStars === 0 && emptyBlockCells.length > 0) {
      return {
        hint: {
          id: nextHintId(),
          kind: 'place-cross',
          technique: ded.technique,
          resultCells: emptyBlockCells,
          explanation: `${ded.explanation || `Block (${ded.block.bRow},${ded.block.bCol}) cannot have any stars.`}`,
          details: [],
        },
        supportingDeductions: [ded],
      };
    }

    // If maxStars is 1 and we already have 1 star, remaining must be crosses
    if (ded.maxStars === 1 && currentStars === 1 && emptyBlockCells.length > 0) {
      return {
        hint: {
          id: nextHintId(),
          kind: 'place-cross',
          technique: ded.technique,
          resultCells: emptyBlockCells,
          explanation: `${ded.explanation || `Block (${ded.block.bRow},${ded.block.bCol}) can have at most 1 star, and already has 1.`}`,
          details: [],
        },
        supportingDeductions: [ded],
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
): MainSolverHintResult | null {
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
        hint: {
          id: nextHintId(),
          kind: 'place-star',
          technique: ded.technique,
          resultCells: emptyCells,
          explanation: `${ded.explanation || `Exclusive set requires ${ded.starsRequired} star(s), and only one candidate cell remains.`}`,
          details: [],
        },
        supportingDeductions: [ded],
      };
    }

    // If we have enough stars, remaining cells must be crosses
    if (currentStars === ded.starsRequired && emptyCells.length > 0) {
      return {
        hint: {
          id: nextHintId(),
          kind: 'place-cross',
          technique: ded.technique,
          resultCells: emptyCells,
          explanation: `${ded.explanation || `Exclusive set already has ${ded.starsRequired} star(s).`}`,
          details: [],
        },
        supportingDeductions: [ded],
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
): MainSolverHintResult | null {
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
        hint: {
          id: nextHintId(),
          kind: 'place-star',
          technique: ded.technique,
          resultCells: emptyCandidates,
          explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} requires exactly ${ded.minStars} more star(s) in ${emptyCandidates.length} candidate cell(s).`}`,
          details: [],
        },
        supportingDeductions: [ded],
      };
    }

    // If minStars equals remainingStars and equals number of candidates
    if (
      ded.minStars !== undefined &&
      ded.minStars === remainingStars &&
      emptyCandidates.length === ded.minStars
    ) {
      return {
        hint: {
          id: nextHintId(),
          kind: 'place-star',
          technique: ded.technique,
          resultCells: emptyCandidates,
          explanation: `${ded.explanation || `Area ${ded.areaType} ${idToLetter(ded.areaId)} requires at least ${ded.minStars} more star(s) in ${emptyCandidates.length} candidate cell(s).`}`,
          details: [],
        },
        supportingDeductions: [ded],
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
): MainSolverHintResult | null {
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
        hint: {
          id: nextHintId(),
          kind: 'place-star',
          technique: relation.technique,
          resultCells: allCandidates,
          explanation: `${relation.explanation || `Area relation requires ${relation.totalStars} total stars, and only one candidate cell remains across all areas.`}`,
          details: [],
        },
        supportingDeductions: [relation],
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
): MainSolverHintResult | null {
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
            hint: {
              id: nextHintId(),
              kind: 'place-star',
              technique: exclusive.technique,
              resultCells: emptyExclusive,
              explanation: `${exclusive.explanation || `Exclusive set within area requires exactly ${exclusive.starsRequired} star(s) in one candidate cell.`}`,
              details: [],
            },
            supportingDeductions: [area, exclusive],
          };
        }
      }
    }
  }

  return null;
}
