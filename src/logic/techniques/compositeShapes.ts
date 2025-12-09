import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  union,
  intersection,
  difference,
  findCompositeShape,
  maxStarsWithTwoByTwo,
  getCell,
  neighbors8,
  formatRow,
  formatCol,
  formatRegions,
} from '../helpers';
import { countSolutions } from '../search';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `composite-shapes-${hintCounter}`;
}

/**
 * Shallow clone of a puzzle state for hypothesis testing
 */
function cloneState(state: PuzzleState): PuzzleState {
  return {
    def: state.def,
    cells: state.cells.map((row) => [...row]),
  };
}

/**
 * Helper to check if all empty cells in a shape can be marked as stars simultaneously
 * Returns the cells that can be safely marked, or null if not all can be marked
 */
function canPlaceAllStars(state: PuzzleState, empties: Coords[]): Coords[] | null {
  const { starsPerUnit } = state.def;
  const safeCells: Coords[] = [];
  
  // Track how many stars we're adding to each row/col/region
  const rowStarCounts = new Map<number, number>();
  const colStarCounts = new Map<number, number>();
  const regionStarCounts = new Map<number, number>();
  
  for (const cell of empties) {
    const nbs = neighbors8(cell, state.def.size);
    const hasAdjacentStar = nbs.some(nb => getCell(state, nb) === 'star');
    if (hasAdjacentStar) return null; // Can't place star here
    
    // Check adjacency with other cells we're planning to mark as stars
    let adjacentToPlanned = false;
    for (const other of safeCells) {
      const rowDiff = Math.abs(cell.row - other.row);
      const colDiff = Math.abs(cell.col - other.col);
      if (rowDiff <= 1 && colDiff <= 1) {
        adjacentToPlanned = true;
        break;
      }
    }
    if (adjacentToPlanned) return null;
    
    // Check if placing a star here would violate row/column/region constraints
    // CRITICAL FIX: Account for stars we're planning to place in the same row/col/region
    const cellRow = rowCells(state, cell.row);
    const cellCol = colCells(state, cell.col);
    const cellRegionId = state.def.regions[cell.row][cell.col];
    const cellRegion = regionCells(state, cellRegionId);
    
    const rowStars = countStars(state, cellRow);
    const colStars = countStars(state, cellCol);
    const regionStars = countStars(state, cellRegion);
    
    const plannedRowStars = rowStarCounts.get(cell.row) || 0;
    const plannedColStars = colStarCounts.get(cell.col) || 0;
    const plannedRegionStars = regionStarCounts.get(cellRegionId) || 0;
    
    if (rowStars + plannedRowStars >= starsPerUnit || 
        colStars + plannedColStars >= starsPerUnit || 
        regionStars + plannedRegionStars >= starsPerUnit) {
      return null; // Would violate unit constraints
    }
    
    // Track that we're planning to place a star here
    rowStarCounts.set(cell.row, plannedRowStars + 1);
    colStarCounts.set(cell.col, plannedColStars + 1);
    regionStarCounts.set(cellRegionId, plannedRegionStars + 1);
    
    safeCells.push(cell);
  }
  
  // Only return if we can place ALL empties as stars
  return safeCells.length === empties.length ? safeCells : null;
}

/**
 * Composite Shapes technique:
 * 
 * Analyzes general composite shapes formed by unions of multiple regions
 * or partial regions. Computes minimum and maximum star bounds for these
 * shapes and identifies forced cells when bounds match requirements.
 * 
 * This is a more general version of undercounting/overcounting that can
 * handle arbitrary combinations of regions and units.
 */
export function findCompositeShapesHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  const startTime = performance.now();
  const timings: Record<string, number> = {};
  let checksPerformed = 0;
  let patternsChecked = {
    threeRegionRow: 0,
    threeRegionCol: 0,
  };

  // Strategy: Look for composite shapes formed by unions of multiple regions
  // that intersect with rows or columns in interesting ways
  
  // NOTE: Skip 2-region unions intersecting with rows/columns - undercounting already handles these correctly
  // Composite-shapes should focus on 3+ region unions and other complex patterns
  
  // Try unions of 2 regions (but skip row/column intersections - undercounting handles those)
  for (let reg1 = 1; reg1 <= size; reg1 += 1) {
    for (let reg2 = reg1 + 1; reg2 <= size; reg2 += 1) {
      const region1 = regionCells(state, reg1);
      const region2 = regionCells(state, reg2);
      const unionRegions = union(region1, region2);
      
      const reg1Stars = countStars(state, region1);
      const reg2Stars = countStars(state, region2);
      const reg1Remaining = starsPerUnit - reg1Stars;
      const reg2Remaining = starsPerUnit - reg2Stars;
      
      if (reg1Remaining <= 0 || reg2Remaining <= 0) continue;
      
      // Skip 2-region unions entirely - undercounting handles these correctly
      // Continue to next region pair
      continue;
    }
  }
  
  // Try unions of 3 regions (which undercounting doesn't handle)
  const threeRegionStartTime = performance.now();
  for (let reg1 = 1; reg1 <= size; reg1 += 1) {
    for (let reg2 = reg1 + 1; reg2 <= size; reg2 += 1) {
      for (let reg3 = reg2 + 1; reg3 <= size; reg3 += 1) {
        const region1 = regionCells(state, reg1);
        const region2 = regionCells(state, reg2);
        const region3 = regionCells(state, reg3);
        const unionRegions = union(union(region1, region2), region3);
        
        const reg1Stars = countStars(state, region1);
        const reg2Stars = countStars(state, region2);
        const reg3Stars = countStars(state, region3);
        const reg1Remaining = starsPerUnit - reg1Stars;
        const reg2Remaining = starsPerUnit - reg2Stars;
        const reg3Remaining = starsPerUnit - reg3Stars;
        
        if (reg1Remaining <= 0 || reg2Remaining <= 0 || reg3Remaining <= 0) continue;
        
        const totalRemaining = reg1Remaining + reg2Remaining + reg3Remaining;
        
        // Try intersecting with rows
        for (let r = 0; r < size; r += 1) {
          patternsChecked.threeRegionRow++;
          checksPerformed++;
          const row = rowCells(state, r);
          const rowStars = countStars(state, row);
          const rowRemaining = starsPerUnit - rowStars;
          
          if (rowRemaining <= 0) continue;
          
          const shape = intersection(row, unionRegions);
          if (shape.length === 0) continue;
          
          const empties = emptyCells(state, shape);
          if (empties.length === 0) continue;
          
          const shapeStars = countStars(state, shape);
          
          // Calculate cells outside the intersection
          const rowOutsideIntersection = difference(row, shape);
          const unionOutsideIntersection = difference(unionRegions, shape);
          
          // Count empty cells outside the intersection
          const emptyCellsInRowOutside = emptyCells(state, rowOutsideIntersection).length;
          const emptyCellsInUnionOutside = emptyCells(state, unionOutsideIntersection).length;
          
          // The union needs at least max(reg1Remaining, reg2Remaining, reg3Remaining) stars
          const unionRemaining = Math.max(reg1Remaining, reg2Remaining, reg3Remaining);
          
          // Compute minimum stars that MUST be in the intersection
          const minStarsInIntersection = Math.max(
            0,
            rowRemaining - emptyCellsInRowOutside,
            unionRemaining - emptyCellsInUnionOutside
          );
          
          // Check for undercounting: minimum stars in intersection equals empty cells
          if (minStarsInIntersection === empties.length && empties.length > 0) {
            const safeCells = canPlaceAllStars(state, empties);
            if (!safeCells) continue; // Can't place all stars, so this deduction doesn't apply
            
            // EXTRA SAFETY GUARD: Check if placing stars would exhaust the row
            const rowEmpties = emptyCells(state, row);
            const rowEmptiesAfter = rowEmpties.filter(e => 
              !safeCells.some(sc => sc.row === e.row && sc.col === e.col)
            ).length;
            if (rowRemaining > rowEmptiesAfter) {
              continue; // Would exhaust the row
            }
            
            // EXTRA SAFETY GUARD: Check if placing stars would exhaust any column
            const affectedCols = new Set(safeCells.map(c => c.col));
            let wouldExhaustColumn = false;
            for (const colIdx of affectedCols) {
              const col = colCells(state, colIdx);
              const colStars = countStars(state, col);
              const colEmpties = emptyCells(state, col);
              const colRemainingStars = starsPerUnit - colStars;
              const colEmptiesAfter = colEmpties.filter(e => 
                !safeCells.some(sc => sc.row === e.row && sc.col === e.col)
              ).length;
              if (colRemainingStars > colEmptiesAfter) {
                wouldExhaustColumn = true;
                break;
              }
            }
            if (wouldExhaustColumn) {
              continue; // Would exhaust a column
            }
            
            // EXTRA SOUNDNESS CHECK: Verify each star is truly forced
            let allStarsForced = true;
            for (const forcedStar of safeCells) {
              const crossState = cloneState(state);
              crossState.cells[forcedStar.row][forcedStar.col] = 'cross';
              const sol = countSolutions(crossState, {
                maxCount: 1,
                timeoutMs: 2000,
                maxDepth: 200,
              });
              if (!sol.timedOut && sol.count > 0) {
                allStarsForced = false;
                break; // This star is not truly forced
              }
            }
            if (!allStarsForced) {
              continue; // Skip this hint if any star is not truly forced
            }
            
            const explanation = `${formatRow(r)} needs ${rowRemaining} more star(s), and ${formatRegions([reg1, reg2, reg3])} together need ${totalRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
            
            return {
              id: nextHintId(),
              kind: 'place-star',
              technique: 'composite-shapes',
              resultCells: safeCells,
              explanation,
              highlights: {
                rows: [r],
                regions: [reg1, reg2, reg3],
                cells: safeCells,
              },
            };
          }
          
          // Check for overcounting
          const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
          const maxPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
          const maxFromUnits = Math.min(
            rowRemaining + shapeStars,
            totalRemaining + shapeStars
          );
          const maxStars = Math.min(maxPossible, maxFromUnits);
          
          if (maxStars === shapeStars && empties.length > 0) {
            const explanation = `${formatRow(r)} intersected with ${formatRegions([reg1, reg2, reg3])} can have at most ${maxStars} star(s) (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
            
            return {
              id: nextHintId(),
              kind: 'place-cross',
              technique: 'composite-shapes',
              resultCells: empties,
              explanation,
              highlights: {
                rows: [r],
                regions: [reg1, reg2, reg3],
                cells: empties,
              },
            };
          }
        }
      }
    }
  }
  timings.threeRegionRow = performance.now() - threeRegionStartTime;

  const totalTime = performance.now() - startTime;
  
  // Always log if it takes significant time or many checks
  if (totalTime > 50 || checksPerformed > 500) {
    console.log(`[COMPOSITE-SHAPES DEBUG] Total time: ${totalTime.toFixed(2)}ms, Total checks: ${checksPerformed}`);
    console.log(`[COMPOSITE-SHAPES DEBUG] Timing breakdown (ms):`, {
      '3-region∩row': timings.threeRegionRow?.toFixed(2) || '0.00',
    });
    console.log(`[COMPOSITE-SHAPES DEBUG] Pattern breakdown (checks):`, {
      '3-region∩row': patternsChecked.threeRegionRow,
      '3-region∩col': patternsChecked.threeRegionCol,
    });
  }

  return null;
}

/**
 * Helper function to analyze a composite shape and check if it forces any cells
 */
function analyzeCompositeShape(
  state: PuzzleState,
  shapeCells: Coords[],
  regionIds: number[],
  minStarsNeeded: number,
  shapeDescription: string
): Hint | null {
  const empties = emptyCells(state, shapeCells);
  if (empties.length === 0) return null;
  
  const shapeStars = countStars(state, shapeCells);
  
  // Check for undercounting: min equals empties + existing
  if (minStarsNeeded === empties.length + shapeStars && empties.length > 0) {
    const safeCells = canPlaceAllStars(state, empties);
    if (!safeCells) return null; // Can't place all stars, so this deduction doesn't apply
    
    // EXTRA SAFETY GUARD: Check if placing stars would exhaust any column
    const affectedCols = new Set(safeCells.map(c => c.col));
    for (const colIdx of affectedCols) {
      const col = colCells(state, colIdx);
      const colStars = countStars(state, col);
      const colEmpties = emptyCells(state, col);
      const colRemainingStars = state.def.starsPerUnit - colStars;
      const colEmptiesAfter = colEmpties.filter(e => 
        !safeCells.some(sc => sc.row === e.row && sc.col === e.col)
      ).length;
      if (colRemainingStars > colEmptiesAfter) {
        return null; // Would exhaust a column
      }
    }
    
    // EXTRA SOUNDNESS CHECK: Verify each star is truly forced
    for (const forcedStar of safeCells) {
      const crossState = cloneState(state);
      crossState.cells[forcedStar.row][forcedStar.col] = 'cross';
      const sol = countSolutions(crossState, {
        maxCount: 1,
        timeoutMs: 2000,
        maxDepth: 200,
      });
      if (!sol.timedOut && sol.count > 0) {
        return null; // This star is not truly forced, skip this hint
      }
    }
    
    const explanation = `The composite shape formed by ${shapeDescription} needs ${minStarsNeeded} star(s) and has exactly ${empties.length} empty cell(s), so all must be stars.`;
    
    return {
      id: nextHintId(),
      kind: 'place-star',
      technique: 'composite-shapes',
      resultCells: safeCells,
      explanation,
      highlights: {
        regions: regionIds,
        cells: safeCells,
      },
    };
  }
  
  // Check for overcounting: max equals existing
  const existingStarCoords = shapeCells.filter((c) => getCell(state, c) === 'star');
  const maxPossible = maxStarsWithTwoByTwo(state, shapeCells, existingStarCoords);
  
  if (maxPossible === shapeStars && empties.length > 0) {
    const explanation = `The composite shape formed by ${shapeDescription} can have at most ${maxPossible} star(s) (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
    
    return {
      id: nextHintId(),
      kind: 'place-cross',
      technique: 'composite-shapes',
      resultCells: empties,
      explanation,
      highlights: {
        regions: regionIds,
        cells: empties,
      },
    };
  }
  
  return null;
}

/**
 * Find result with deductions support
 */
export function findCompositeShapesResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findCompositeShapesHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    // For now, composite shapes primarily produces hints directly
    return { type: 'hint', hint };
  }

  // For composite shapes, we could emit ExclusiveSetDeduction when we find
  // R stars in R cells, but the technique is complex and primarily produces hints.
  // More sophisticated deduction extraction could be added later.

  return { type: 'none' };
}
