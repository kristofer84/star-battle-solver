import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import { 
  rowCells, 
  colCells, 
  regionCells, 
  emptyCells, 
  countStars,
  getCell,
  union,
  difference,
  formatRow,
  formatCol,
  formatRegion
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `at-sea-${hintCounter}`;
}

/**
 * At Sea technique:
 * 
 * Identifies isolated regions or cell sets where stars must be placed
 * due to isolation constraints. When a set of cells is "at sea" (isolated
 * from other possibilities), we can derive forced moves based on the
 * isolation.
 * 
 * For example, if a unit needs N more stars and only has N cells available
 * that don't violate constraints with other units, those cells must all be stars.
 * 
 * Requirements: 14.1, 14.3
 */
export function findAtSeaHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Check each unit (row, column, region) for isolation patterns
  
  // Check rows
  for (let r = 0; r < size; r++) {
    const hint = checkUnitForIsolation(state, 'row', r);
    if (hint) return hint;
  }

  // Check columns
  for (let c = 0; c < size; c++) {
    const hint = checkUnitForIsolation(state, 'col', c);
    if (hint) return hint;
  }

  // Check regions
  for (let regionId = 1; regionId <= 10; regionId++) {
    const hint = checkUnitForIsolation(state, 'region', regionId);
    if (hint) return hint;
  }

  return null;
}

/**
 * Find result with deductions support
 */
export function findAtSeaResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findAtSeaHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // At sea finds isolated cells that must be stars.
  // We could emit AreaDeduction for isolated units,
  // but the technique is complex and primarily produces hints directly.

  return { type: 'none' };
}

/**
 * Check a single unit for isolation patterns
 */
function checkUnitForIsolation(
  state: PuzzleState,
  unitType: 'row' | 'col' | 'region',
  unitId: number
): Hint | null {
  const { starsPerUnit } = state.def;

  // Get cells in this unit
  let unitCellsList: Coords[];
  if (unitType === 'row') {
    unitCellsList = rowCells(state, unitId);
  } else if (unitType === 'col') {
    unitCellsList = colCells(state, unitId);
  } else {
    unitCellsList = regionCells(state, unitId);
  }

  const currentStars = countStars(state, unitCellsList);
  const remaining = starsPerUnit - currentStars;

  // If unit is already satisfied, no forcing
  if (remaining <= 0) return null;

  const empties = emptyCells(state, unitCellsList);

  // If not enough empties, puzzle is invalid (shouldn't happen in valid puzzles)
  if (empties.length < remaining) return null;

  // Look for isolation: cells that are "at sea" - isolated from other units' needs
  // This happens when placing stars in certain cells would isolate other units
  
  // Strategy: Find cells that, if NOT used for stars in this unit,
  // would make it impossible for other intersecting units to satisfy their quotas
  
  const isolatedCells = findIsolatedCells(state, unitType, unitId, empties);
  
  if (isolatedCells.length > 0) {
    // Check if these isolated cells must all be stars
    if (isolatedCells.length === remaining) {
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'at-sea',
        resultCells: isolatedCells,
        explanation: buildIsolationExplanation(
          state,
          unitType,
          unitId,
          isolatedCells,
          'star'
        ),
        highlights: {
          cells: isolatedCells,
          ...(unitType === 'row' ? { rows: [unitId] } : {}),
          ...(unitType === 'col' ? { cols: [unitId] } : {}),
          ...(unitType === 'region' ? { regions: [unitId] } : {}),
        },
      };
    }

    // Check if some cells must be crosses due to isolation
    const nonIsolatedCells = difference(empties, isolatedCells);
    if (nonIsolatedCells.length > 0 && isolatedCells.length < remaining) {
      // If we have more isolated cells than needed, and some non-isolated cells,
      // the non-isolated cells might be forced to be crosses
      const maxStarsInNonIsolated = empties.length - remaining;
      if (maxStarsInNonIsolated === 0 && nonIsolatedCells.length > 0) {
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'at-sea',
          resultCells: nonIsolatedCells,
          explanation: buildIsolationExplanation(
            state,
            unitType,
            unitId,
            nonIsolatedCells,
            'cross'
          ),
          highlights: {
            cells: union(isolatedCells, nonIsolatedCells),
            ...(unitType === 'row' ? { rows: [unitId] } : {}),
            ...(unitType === 'col' ? { cols: [unitId] } : {}),
            ...(unitType === 'region' ? { regions: [unitId] } : {}),
          },
        };
      }
    }
  }

  return null;
}

/**
 * Find cells that are isolated - they are the only viable options
 * for satisfying multiple unit constraints simultaneously
 */
function findIsolatedCells(
  state: PuzzleState,
  unitType: 'row' | 'col' | 'region',
  unitId: number,
  empties: Coords[]
): Coords[] {
  const { starsPerUnit } = state.def;
  
  // Find cells that are critical for intersecting units
  // A cell is isolated if it's the only way for an intersecting unit to reach its quota
  
  const isolatedSet: Coords[] = [];

  for (const cell of empties) {
    // Check if this cell is critical for any intersecting unit
    const isCritical = isCellCriticalForIntersectingUnits(
      state,
      cell,
      unitType,
      unitId
    );
    
    if (isCritical) {
      isolatedSet.push(cell);
    }
  }

  return isolatedSet;
}

/**
 * Check if a cell is critical for any intersecting units
 * (i.e., removing it would make those units unable to reach their quota)
 */
function isCellCriticalForIntersectingUnits(
  state: PuzzleState,
  cell: Coords,
  excludeUnitType: 'row' | 'col' | 'region',
  excludeUnitId: number
): boolean {
  const { starsPerUnit } = state.def;

  // Check row (if not the excluded unit)
  if (excludeUnitType !== 'row') {
    const rowCellsList = rowCells(state, cell.row);
    const rowStars = countStars(state, rowCellsList);
    const rowRemaining = starsPerUnit - rowStars;
    const rowEmpties = emptyCells(state, rowCellsList);
    
    // If this row needs exactly as many stars as it has empties,
    // then this cell is critical
    if (rowRemaining > 0 && rowEmpties.length === rowRemaining) {
      return true;
    }
  }

  // Check column (if not the excluded unit)
  if (excludeUnitType !== 'col') {
    const colCellsList = colCells(state, cell.col);
    const colStars = countStars(state, colCellsList);
    const colRemaining = starsPerUnit - colStars;
    const colEmpties = emptyCells(state, colCellsList);
    
    if (colRemaining > 0 && colEmpties.length === colRemaining) {
      return true;
    }
  }

  // Check region (if not the excluded unit)
  if (excludeUnitType !== 'region') {
    const regionId = state.def.regions[cell.row][cell.col];
    const regionCellsList = regionCells(state, regionId);
    const regionStars = countStars(state, regionCellsList);
    const regionRemaining = starsPerUnit - regionStars;
    const regionEmpties = emptyCells(state, regionCellsList);
    
    if (regionRemaining > 0 && regionEmpties.length === regionRemaining) {
      return true;
    }
  }

  return false;
}

/**
 * Build explanation for the isolation pattern
 */
function buildIsolationExplanation(
  state: PuzzleState,
  unitType: 'row' | 'col' | 'region',
  unitId: number,
  cells: Coords[],
  resultType: 'star' | 'cross'
): string {
  const unitName = formatUnitName(unitType, unitId);
  const cellRefs = cells.map(c => `(${c.row + 1}, ${c.col + 1})`).join(', ');

  if (resultType === 'star') {
    return `At sea: ${unitName} has isolated cells ${cellRefs} that must all be stars to satisfy intersecting unit constraints.`;
  } else {
    return `At sea: ${unitName} has cells ${cellRefs} that must be crosses because the remaining stars must go in other isolated positions.`;
  }
}

/**
 * Format unit name for explanation
 */
function formatUnitName(unitType: 'row' | 'col' | 'region', unitId: number): string {
  if (unitType === 'row') {
    return formatRow(unitId);
  } else if (unitType === 'col') {
    return formatCol(unitId);
  } else {
    return `Region ${formatRegion(unitId)}`;
  }
}
