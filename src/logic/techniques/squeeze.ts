import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, AreaRelationDeduction, AreaDeduction } from '../../types/deductions';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  intersection,
  formatRow,
  formatCol,
  formatRegion,
} from '../helpers';
import { canPlaceAllStarsSimultaneously, isValidStarPlacement } from '../constraints/placement';

let hintCounter = 0;
const cellKey = (cell: Coords) => `${cell.row},${cell.col}`;

function nextHintId() {
  hintCounter += 1;
  return `squeeze-${hintCounter}`;
}

/**
 * Squeeze technique:
 * 
 * Identifies situations where stars must fit into constrained spaces due to
 * crosses and 2×2 blocks. When multiple units intersect and their combined
 * constraints force specific placements, this technique identifies those forced cells.
 * 
 * The technique looks for:
 * - Intersections of units (row+region, col+region) that need stars
 * - Valid placements within those intersections (avoiding crosses, adjacency, 2×2 violations)
 * - Situations where the number of valid placements equals the stars needed
 * 
 * Key difference from undercounting: Squeeze considers the spatial constraints
 * (adjacency, 2×2) that reduce valid placements, not just counting arguments.
 */
export function findSqueezeHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  const startTime = performance.now();
  const timings: Record<string, number> = {};
  let checksPerformed = 0;
  let patternsChecked = {
    rowRegion: 0,
    colRegion: 0,
    singleRow: 0,
    singleCol: 0,
    singleRegion: 0,
  };
  let iterations = 0;
  const MAX_ITERATIONS = 10000; // Safety limit

  // Strategy: Look for intersections of units where valid placements are squeezed
  // by spatial constraints (crosses, adjacency, 2×2 blocks)
  
  // Try intersections of rows with regions
  const rowRegionStartTime = performance.now();
  for (let r = 0; r < size; r += 1) {
    iterations++;
    if (iterations > MAX_ITERATIONS) {
      console.error(`[FREEZE] Squeeze: Hit iteration limit (${MAX_ITERATIONS})`);
      return null;
    }
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;

    if (rowRemaining <= 0) continue;

    const rowEmptyCells = emptyCells(state, row);
    const rowValidPlacements = rowEmptyCells.filter(cell => isValidStarPlacement(state, cell));

    for (let regionId = 1; regionId <= size; regionId += 1) {
      patternsChecked.rowRegion++;
      checksPerformed++;
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;

      if (regionRemaining <= 0) continue;

      const regionEmpties = emptyCells(state, region);
      const regionValidPlacements = regionEmpties.filter(cell => isValidStarPlacement(state, cell));

      // Find intersection of row and region
      const shape = intersection(row, region);
      if (shape.length === 0) continue;

      const shapeSet = new Set(shape.map(cellKey));

      const rowValidOutside = rowValidPlacements.filter(cell => !shapeSet.has(cellKey(cell))).length;
      const regionValidOutside = regionValidPlacements.filter(cell => !shapeSet.has(cellKey(cell))).length;

      const rowNeeded = Math.max(0, rowRemaining - rowValidOutside);
      const regionNeeded = Math.max(0, regionRemaining - regionValidOutside);
      const starsForced = Math.max(rowNeeded, regionNeeded);

      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;

      // Find valid placements (cells where a star can be placed without immediate violations)
      const validPlacementStart = performance.now();
      const validPlacements = empties.filter(cell => isValidStarPlacement(state, cell));
      const validPlacementTime = performance.now() - validPlacementStart;
      if (validPlacementTime > 10 && empties.length > 10) {
        console.log(`[DEBUG] Squeeze: isValidStarPlacement took ${validPlacementTime.toFixed(2)}ms for ${empties.length} cells`);
      }

      if (validPlacements.length === 0) continue;

      if (starsForced > 0 && validPlacements.length === starsForced) {
        // Verify that ALL valid placements can actually be stars simultaneously
        const canPlaceStart = performance.now();
        const safeCells = canPlaceAllStarsSimultaneously(state, validPlacements, starsPerUnit);
        const canPlaceTime = performance.now() - canPlaceStart;
        if (canPlaceTime > 10) {
          console.log(`[DEBUG] Squeeze: canPlaceAllStarsSimultaneously took ${canPlaceTime.toFixed(2)}ms for ${validPlacements.length} cells`);
        }
        if (!safeCells) continue; // Can't place all stars, so this deduction doesn't apply
        
        const explanation = `${formatRow(r)} needs ${rowRemaining} star(s) and region ${formatRegion(regionId)} needs ${regionRemaining} star(s). Due to crosses and 2×2 constraints, their intersection has only ${validPlacements.length} valid placement(s), so all must be stars.`;
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'squeeze',
          resultCells: safeCells,
          explanation,
          highlights: {
            rows: [r],
            regions: [regionId],
            cells: safeCells,
          },
        };
      }
    }
  }
  timings.rowRegion = performance.now() - rowRegionStartTime;
  
  // Try intersections of columns with regions
  const colRegionStartTime = performance.now();
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const colStars = countStars(state, col);
    const colRemaining = starsPerUnit - colStars;

    if (colRemaining <= 0) continue;

    const colEmptyCells = emptyCells(state, col);
    const colValidPlacements = colEmptyCells.filter(cell => isValidStarPlacement(state, cell));

    for (let regionId = 1; regionId <= size; regionId += 1) {
      patternsChecked.colRegion++;
      checksPerformed++;
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;

      if (regionRemaining <= 0) continue;

      const regionEmpties = emptyCells(state, region);
      const regionValidPlacements = regionEmpties.filter(cell => isValidStarPlacement(state, cell));

      // Find intersection of column and region
      const shape = intersection(col, region);
      if (shape.length === 0) continue;

      const shapeSet = new Set(shape.map(cellKey));

      const colValidOutside = colValidPlacements.filter(cell => !shapeSet.has(cellKey(cell))).length;
      const regionValidOutside = regionValidPlacements.filter(cell => !shapeSet.has(cellKey(cell))).length;

      const colNeeded = Math.max(0, colRemaining - colValidOutside);
      const regionNeeded = Math.max(0, regionRemaining - regionValidOutside);
      const starsForced = Math.max(colNeeded, regionNeeded);

      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;

      // Find valid placements (cells where a star can be placed without immediate violations)
      const validPlacementStart = performance.now();
      const validPlacements = empties.filter(cell => isValidStarPlacement(state, cell));
      const validPlacementTime = performance.now() - validPlacementStart;
      if (validPlacementTime > 10 && empties.length > 10) {
        console.log(`[DEBUG] Squeeze: isValidStarPlacement took ${validPlacementTime.toFixed(2)}ms for ${empties.length} cells`);
      }

      if (validPlacements.length === 0) continue;

      if (starsForced > 0 && validPlacements.length === starsForced) {
        // Verify that ALL valid placements can actually be stars simultaneously
        const canPlaceStart = performance.now();
        const safeCells = canPlaceAllStarsSimultaneously(state, validPlacements, starsPerUnit);
        const canPlaceTime = performance.now() - canPlaceStart;
        if (canPlaceTime > 10) {
          console.log(`[DEBUG] Squeeze: canPlaceAllStarsSimultaneously took ${canPlaceTime.toFixed(2)}ms for ${validPlacements.length} cells`);
        }
        if (!safeCells) continue; // Can't place all stars, so this deduction doesn't apply
        
        const explanation = `${formatCol(c)} needs ${colRemaining} star(s) and region ${formatRegion(regionId)} needs ${regionRemaining} star(s). Due to crosses and 2×2 constraints, their intersection has only ${validPlacements.length} valid placement(s), so all must be stars.`;
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'squeeze',
          resultCells: safeCells,
          explanation,
          highlights: {
            cols: [c],
            regions: [regionId],
            cells: safeCells,
          },
        };
      }
    }
  }
  timings.colRegion = performance.now() - colRegionStartTime;
  
  // Try single units with narrow corridors
  // Check rows
  const singleRowStartTime = performance.now();
  for (let r = 0; r < size; r += 1) {
    patternsChecked.singleRow++;
    checksPerformed++;
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    const empties = emptyCells(state, row);
    if (empties.length === 0) continue;
    
    const validPlacements = empties.filter(cell => isValidStarPlacement(state, cell));
    
    if (validPlacements.length === rowRemaining && validPlacements.length > 0) {
      const safeCells = canPlaceAllStarsSimultaneously(state, validPlacements, starsPerUnit);
      if (!safeCells) continue;
      
      const explanation = `Row ${r + 1} needs ${rowRemaining} star(s). Due to crosses and 2×2 constraints, only ${validPlacements.length} cell(s) can contain stars, so all must be stars.`;
      
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'squeeze',
        resultCells: safeCells,
        explanation,
        highlights: {
          rows: [r],
          cells: safeCells,
        },
      };
    }
  }
  timings.singleRow = performance.now() - singleRowStartTime;
  
  // Check columns
  const singleColStartTime = performance.now();
  for (let c = 0; c < size; c += 1) {
    patternsChecked.singleCol++;
    checksPerformed++;
    const col = colCells(state, c);
    const colStars = countStars(state, col);
    const colRemaining = starsPerUnit - colStars;
    
    if (colRemaining <= 0) continue;
    
    const empties = emptyCells(state, col);
    if (empties.length === 0) continue;
    
    const validPlacements = empties.filter(cell => isValidStarPlacement(state, cell));
    
    if (validPlacements.length === colRemaining && validPlacements.length > 0) {
      const safeCells = canPlaceAllStarsSimultaneously(state, validPlacements, starsPerUnit);
      if (!safeCells) continue;
      
      const explanation = `${formatCol(c)} needs ${colRemaining} star(s). Due to crosses and 2×2 constraints, only ${validPlacements.length} cell(s) can contain stars, so all must be stars.`;
      
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'squeeze',
        resultCells: safeCells,
        explanation,
        highlights: {
          cols: [c],
          cells: safeCells,
        },
      };
    }
  }
  timings.singleCol = performance.now() - singleColStartTime;
  
  // Check regions
  const singleRegionStartTime = performance.now();
  for (let regionId = 1; regionId <= size; regionId += 1) {
    patternsChecked.singleRegion++;
    checksPerformed++;
    const region = regionCells(state, regionId);
    const regionStars = countStars(state, region);
    const regionRemaining = starsPerUnit - regionStars;
    
    if (regionRemaining <= 0) continue;
    
    const empties = emptyCells(state, region);
    if (empties.length === 0) continue;
    
    const validPlacements = empties.filter(cell => isValidStarPlacement(state, cell));

    if (validPlacements.length === regionRemaining && validPlacements.length > 0) {
      const safeCells = canPlaceAllStarsSimultaneously(state, validPlacements, starsPerUnit);
      if (!safeCells) continue;
      
      const explanation = `Region ${formatRegion(regionId)} needs ${regionRemaining} star(s). Due to crosses and 2×2 constraints, only ${validPlacements.length} cell(s) can contain stars, so all must be stars.`;
      
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'squeeze',
        resultCells: safeCells,
        explanation,
        highlights: {
          regions: [regionId],
          cells: safeCells,
        },
      };
    }
  }
  timings.singleRegion = performance.now() - singleRegionStartTime;

  const totalTime = performance.now() - startTime;
  
  // Always log if it takes significant time or many checks
  if (totalTime > 50 || checksPerformed > 500) {
    console.log(`[SQUEEZE DEBUG] Total time: ${totalTime.toFixed(2)}ms, Total checks: ${checksPerformed}`);
    console.log(`[SQUEEZE DEBUG] Timing breakdown (ms):`, {
      'row∩region': timings.rowRegion?.toFixed(2) || '0.00',
      'col∩region': timings.colRegion?.toFixed(2) || '0.00',
      'single-row': timings.singleRow?.toFixed(2) || '0.00',
      'single-col': timings.singleCol?.toFixed(2) || '0.00',
      'single-region': timings.singleRegion?.toFixed(2) || '0.00',
    });
    console.log(`[SQUEEZE DEBUG] Pattern breakdown (checks):`, {
      'row∩region': patternsChecked.rowRegion,
      'col∩region': patternsChecked.colRegion,
      'single-row': patternsChecked.singleRow,
      'single-col': patternsChecked.singleCol,
      'single-region': patternsChecked.singleRegion,
    });
  }

  return null;
}

/**
 * Find result with deductions support
 */
export function findSqueezeResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit } = state.def;
  const deductions: Deduction[] = [];

  // Try to find a clear hint first
  const hint = findSqueezeHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // Squeeze finds intersections where stars are forced.
  // We could emit AreaRelationDeduction for row+region intersections,
  // but the technique is complex and primarily produces hints directly.
  // More sophisticated deduction extraction could be added later.

  return { type: 'none' };
}
