import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  intersection,
  getCell,
  maxStarsWithTwoByTwo,
  neighbors8,
  formatRow,
  formatCol,
  formatRegion,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `finned-counts-${hintCounter}`;
}

/**
 * Check if placing stars in all given cells would violate adjacency or 2×2 constraints
 */
function canPlaceAllStars(state: PuzzleState, cells: Coords[]): boolean {
  const { size } = state.def;
  
  // Check for adjacency violations: no two stars can be adjacent (including diagonally)
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];
      
      // Check if cells are adjacent (including diagonally)
      const rowDiff = Math.abs(cell1.row - cell2.row);
      const colDiff = Math.abs(cell1.col - cell2.col);
      if (rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0)) {
        return false; // Adjacent cells cannot both be stars
      }
    }
    
    // Also check adjacency with existing stars
    const neighbors = neighbors8(cells[i], size);
    for (const neighbor of neighbors) {
      if (state.cells[neighbor.row][neighbor.col] === 'star') {
        return false; // Would be adjacent to existing star
      }
    }
  }
  
  // Check for 2×2 violations: no 2×2 block can have more than 1 star
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const block: Coords[] = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];
      
      // Count how many of the cells we're placing stars in are in this block
      let starsInBlock = 0;
      for (const cell of cells) {
        if (block.some(b => b.row === cell.row && b.col === cell.col)) {
          starsInBlock++;
        }
      }
      
      // Also count existing stars in this block
      for (const blockCell of block) {
        if (state.cells[blockCell.row][blockCell.col] === 'star') {
          starsInBlock++;
        }
      }
      
      if (starsInBlock > 1) {
        return false; // Would create a 2×2 block with more than 1 star
      }
    }
  }
  
  return true;
}

/**
 * Finned Counts technique:
 * 
 * Identifies counting arguments that hold except for specific "fin" cells.
 * Performs case analysis on the fin cells to derive forced moves.
 * 
 * A finned count occurs when:
 * 1. A composite shape has a counting argument (min/max stars)
 * 2. The argument would force certain cells, except for a small set of "fin" cells
 * 3. By analyzing both cases (fin is star vs fin is cross), we can derive forced moves
 */
export function findFinnedCountsHint(state: PuzzleState): Hint | null {
  // TEMPORARILY DISABLED: The finned-counts technique has fundamental logical flaws
  // that cause it to make incorrect deductions. It needs to be completely redesigned
  // to properly handle case analysis without making arbitrary choices.
  // See tests: debugFinnedCountsIteration8.test.ts and debugIteration8NewIssue.test.ts
  return null;
  
  const { size, starsPerUnit } = state.def;

  // Strategy: Look for composite shapes where a counting argument almost works
  // but fails due to a small number of "fin" cells
  
  // Try row-region intersections with potential fins
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    for (let regionId = 0; regionId < size; regionId += 1) {
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of row and region
      const shape = intersection(row, region);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length <= 2) continue; // Need at least 3 cells for a fin pattern
      
      const minStarsNeeded = Math.max(rowRemaining, regionRemaining);
      
      // CRITICAL FIX: For a finned pattern to work, we need to ensure that
      // the case analysis actually forces cells. This only happens when:
      // 1. The intersection is "almost full" relative to at least one of the units
      // 2. Specifically, one unit must have ALL or ALMOST ALL of its remaining stars
      //    forced into the intersection
      
      // Check if this is a valid finned pattern:
      // We need minStarsNeeded == empties.length - 1, AND
      // At least one of the units (row or region) must have very few alternatives outside the intersection
      
      const rowEmpties = emptyCells(state, row);
      const regionEmpties = emptyCells(state, region);
      const rowEmptiesOutside = rowEmpties.length - empties.length;
      const regionEmptiesOutside = regionEmpties.length - empties.length;
      
      // For the finned argument to work, BOTH units must be forced to use the intersection
      // If only one unit is forced, we can't make definitive placements
      // because the other unit has freedom to place stars elsewhere
      const rowMustUseIntersection = rowEmptiesOutside < rowRemaining;
      const regionMustUseIntersection = regionEmptiesOutside < regionRemaining;
      
      if (minStarsNeeded === empties.length - 1 && empties.length >= 2 && 
          rowMustUseIntersection && regionMustUseIntersection) {
        // Try each cell as a potential fin
        for (let finIdx = 0; finIdx < empties.length; finIdx += 1) {
          const finCell = empties[finIdx];
          const nonFinCells = empties.filter((_, idx) => idx !== finIdx);
          
          // Case 1: If fin is a star, then we need (minStarsNeeded - 1) more stars in non-fin cells
          // Case 2: If fin is a cross, then we need minStarsNeeded stars in non-fin cells
          
          // If in both cases, certain cells must be stars, those are forced
          const case1Needed = minStarsNeeded - 1;
          const case2Needed = minStarsNeeded;
          
          // If case2Needed equals the number of non-fin cells, all non-fin cells must be stars
          // BUT: we must verify this doesn't violate adjacency or 2×2 constraints
          if (case2Needed === nonFinCells.length && nonFinCells.length > 0) {
            // Check if placing stars in all non-fin cells would violate constraints
            if (!canPlaceAllStars(state, nonFinCells)) {
              continue; // Skip this fin - placing all stars would violate constraints
            }
            
            const explanation = `${formatRow(r)} needs ${rowRemaining} more star(s) and region ${formatRegion(regionId)} needs ${regionRemaining} more star(s). Their intersection has ${empties.length} empty cells. Using a finned counting argument with cell (${finCell.row},${finCell.col}) as the fin: if the fin is a cross, then all ${nonFinCells.length} remaining cells must be stars. If the fin is a star, at least ${case1Needed} of the remaining cells must be stars.`;
            
            return {
              id: nextHintId(),
              kind: 'place-star',
              technique: 'finned-counts',
              resultCells: nonFinCells,
              explanation,
              highlights: {
                rows: [r],
                regions: [regionId],
                cells: [...nonFinCells, finCell], // Highlight both main shape and fin
              },
            };
          }
        }
      }
    }
  }
  
  // Try column-region intersections with potential fins
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const colStars = countStars(state, col);
    const colRemaining = starsPerUnit - colStars;
    
    if (colRemaining <= 0) continue;
    
    for (let regionId = 0; regionId < size; regionId += 1) {
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of column and region
      const shape = intersection(col, region);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length <= 2) continue;
      
      const minStarsNeeded = Math.max(colRemaining, regionRemaining);
      
      // Apply the same fix as for row-region intersections
      const colEmpties = emptyCells(state, col);
      const regionEmpties = emptyCells(state, region);
      const colEmptiesOutside = colEmpties.length - empties.length;
      const regionEmptiesOutside = regionEmpties.length - empties.length;
      
      const colMustUseIntersection = colEmptiesOutside < colRemaining;
      const regionMustUseIntersection = regionEmptiesOutside < regionRemaining;
      
      // ADDITIONAL FIX: Both units must be forced to use the intersection
      // If only one unit is forced, we can't make definitive placements
      // because the other unit has freedom to place stars elsewhere
      if (minStarsNeeded === empties.length - 1 && empties.length >= 2 &&
          colMustUseIntersection && regionMustUseIntersection) {
        for (let finIdx = 0; finIdx < empties.length; finIdx += 1) {
          const finCell = empties[finIdx];
          const nonFinCells = empties.filter((_, idx) => idx !== finIdx);
          
          const case2Needed = minStarsNeeded;
          
          if (case2Needed === nonFinCells.length && nonFinCells.length > 0) {
            // Check if placing stars in all non-fin cells would violate constraints
            if (!canPlaceAllStars(state, nonFinCells)) {
              continue; // Skip this fin - placing all stars would violate constraints
            }
            
            const explanation = `${formatCol(c)} needs ${colRemaining} more star(s) and region ${formatRegion(regionId)} needs ${regionRemaining} more star(s). Their intersection has ${empties.length} empty cells. Using a finned counting argument with cell (${finCell.row},${finCell.col}) as the fin: if the fin is a cross, then all ${nonFinCells.length} remaining cells must be stars.`;
            
            return {
              id: nextHintId(),
              kind: 'place-star',
              technique: 'finned-counts',
              resultCells: nonFinCells,
              explanation,
              highlights: {
                cols: [c],
                regions: [regionId],
                cells: [...nonFinCells, finCell],
              },
            };
          }
        }
      }
    }
  }
  
  // Try overcounting finned patterns (where fins prevent us from marking crosses)
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    for (let regionId = 0; regionId < size; regionId += 1) {
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      const shape = intersection(row, region);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length < 2) continue; // Need at least 2 empty cells for a fin pattern
      
      const shapeStars = countStars(state, shape);
      const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
      const maxStarsPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
      
      // Check for finned overcounting: max is reached except for a fin
      const maxFromUnits = Math.min(rowRemaining + shapeStars, regionRemaining + shapeStars);
      const maxStars = Math.min(maxStarsPossible, maxFromUnits);
      
      // If max is one less than current empties + stars, we have a finned pattern
      // This pattern only applies when empties.length === 2 (1 fin + 1 non-fin)
      if (maxStars === shapeStars + empties.length - 1 && empties.length === 2) {
        // Try each cell as a potential fin
        for (let finIdx = 0; finIdx < empties.length; finIdx += 1) {
          const finCell = empties[finIdx];
          const nonFinCells = empties.filter((_, idx) => idx !== finIdx);
          
          // If fin is a star, then all non-fin cells must be crosses
          // BUT: This is only true when empties.length === 2 (i.e., nonFinCells.length === 1)
          // When empties.length > 2:
          //   - If fin is star: we can place at most (maxStars - shapeStars - 1) = (empties.length - 2) stars in non-fin cells
          //   - We have (empties.length - 1) non-fin cells
          //   - So at least 1 non-fin cell must be a cross, but NOT all of them
          //   - Therefore, we cannot mark all non-fin cells as crosses when empties.length > 2
          
          // Only apply this deduction when we have exactly 2 empty cells (1 fin + 1 non-fin)
          if (empties.length !== 2 || nonFinCells.length !== 1) {
            continue;
          }
          
          // Check if fin can be a star
          const finNeighbors = neighbors8(finCell, size);
          let finCanBeStar = true;
          for (const neighbor of finNeighbors) {
            if (state.cells[neighbor.row][neighbor.col] === 'star') {
              finCanBeStar = false;
              break;
            }
          }
          
          // Also check 2x2 constraint for fin
          if (finCanBeStar) {
            for (let r = Math.max(0, finCell.row - 1); r <= Math.min(size - 2, finCell.row); r++) {
              for (let c = Math.max(0, finCell.col - 1); c <= Math.min(size - 2, finCell.col); c++) {
                const block: Coords[] = [
                  { row: r, col: c },
                  { row: r, col: c + 1 },
                  { row: r + 1, col: c },
                  { row: r + 1, col: c + 1 },
                ];
                let starsInBlock = 0;
                for (const blockCell of block) {
                  if (state.cells[blockCell.row][blockCell.col] === 'star') {
                    starsInBlock++;
                  }
                }
                if (starsInBlock >= 1) {
                  finCanBeStar = false;
                  break;
                }
              }
              if (!finCanBeStar) break;
            }
          }
          
          // Only apply this deduction if the fin CAN be a star
          // If the fin cannot be a star, then this pattern doesn't apply
          if (!finCanBeStar) {
            continue;
          }
          
          if (nonFinCells.length > 0) {
            const explanation = `${formatRow(r)} and region ${formatRegion(regionId)} can have at most ${maxStars} star(s) in their intersection. Using a finned overcounting argument with cell (${finCell.row},${finCell.col}) as the fin: if the fin is a star, then all ${nonFinCells.length} remaining cells must be crosses.`;
            
            return {
              id: nextHintId(),
              kind: 'place-cross',
              technique: 'finned-counts',
              resultCells: nonFinCells,
              explanation,
              highlights: {
                rows: [r],
                regions: [regionId],
                cells: [...nonFinCells, finCell],
              },
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Find result with deductions support
 * Note: Finned-counts is currently disabled due to logical flaws.
 * When re-enabled, it should emit ExclusiveSetDeduction for fin patterns.
 */
export function findFinnedCountsResult(state: PuzzleState): TechniqueResult {
  const deductions: Deduction[] = [];

  // Try to find a clear hint first
  const hint = findFinnedCountsHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    // Currently disabled - no deductions emitted
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  // Currently disabled - no deductions emitted
  return { type: 'none' };
}
