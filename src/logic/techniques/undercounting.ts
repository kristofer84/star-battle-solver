import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  union,
  intersection,
  findCompositeShape,
  neighbors8,
  getCell,
  difference,
} from '../helpers';

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

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `undercounting-${hintCounter}`;
}

/**
 * Undercounting technique:
 * 
 * Identifies composite shapes (unions of regions or partial regions) where
 * the minimum number of stars that must be placed equals the number of
 * empty cells, forcing all those cells to be stars.
 * 
 * The minimum star count considers:
 * - Stars already placed in the shape
 * - Unit quotas that must be satisfied
 * - 2×2 constraints that limit placement
 * - Adjacency rules
 */
export function findUndercountingHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Strategy: Look for composite shapes formed by intersections of units
  // where the minimum star count forces specific cells to be stars
  
  // Try intersections of rows with regions
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    for (let regionId = 1; regionId <= size; regionId += 1) {
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of row and region
      const shape = intersection(row, region);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;
      
      // Calculate cells outside the intersection
      const rowOutsideIntersection = difference(row, shape);
      const regionOutsideIntersection = difference(region, shape);
      
      // Count empty cells outside the intersection
      const emptyCellsInRowOutside = emptyCells(state, rowOutsideIntersection).length;
      const emptyCellsInRegionOutside = emptyCells(state, regionOutsideIntersection).length;
      
      // Compute minimum stars that MUST be in the intersection
      // This considers that the row/region could get stars from outside the intersection
      const shapeStars = countStars(state, shape);
      const minStarsInIntersection = Math.max(
        0,
        rowRemaining - emptyCellsInRowOutside,
        regionRemaining - emptyCellsInRegionOutside
      );
      
      // If minimum equals the number of empty cells in the intersection,
      // all empty cells must be stars
      if (minStarsInIntersection === empties.length && empties.length > 0) {
        // Validate that placing stars in ALL empty cells doesn't violate constraints
        if (!canPlaceAllStars(state, empties)) {
          continue; // Skip if placing all stars would violate constraints
        }
        
        const explanation = `Row ${r + 1} needs ${rowRemaining} more star(s) and region ${regionId} needs ${regionRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'undercounting',
          resultCells: empties, // Return ALL empty cells, not just one
          explanation,
          highlights: {
            rows: [r],
            regions: [regionId],
            cells: empties,
          },
        };
      }
    }
  }
  
  // Try intersections of columns with regions
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const colStars = countStars(state, col);
    const colRemaining = starsPerUnit - colStars;
    
    if (colRemaining <= 0) continue;
    
    for (let regionId = 1; regionId <= size; regionId += 1) {
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of column and region
      const shape = intersection(col, region);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;
      
      // Calculate cells outside the intersection
      const colOutsideIntersection = difference(col, shape);
      const regionOutsideIntersection = difference(region, shape);
      
      // Count empty cells outside the intersection
      const emptyCellsInColOutside = emptyCells(state, colOutsideIntersection).length;
      const emptyCellsInRegionOutside = emptyCells(state, regionOutsideIntersection).length;
      
      // Compute minimum stars that MUST be in the intersection
      // This considers that the column/region could get stars from outside the intersection
      const shapeStars = countStars(state, shape);
      const minStarsInIntersection = Math.max(
        0,
        colRemaining - emptyCellsInColOutside,
        regionRemaining - emptyCellsInRegionOutside
      );
      
      // If minimum equals the number of empty cells in the intersection,
      // all empty cells must be stars
      if (minStarsInIntersection === empties.length && empties.length > 0) {
        // Validate that placing stars in ALL empty cells doesn't violate constraints
        if (!canPlaceAllStars(state, empties)) {
          continue; // Skip if placing all stars would violate constraints
        }
        
        const explanation = `Column ${c + 1} needs ${colRemaining} more star(s) and region ${regionId} needs ${regionRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'undercounting',
          resultCells: empties, // Return ALL empty cells, not just one
          explanation,
          highlights: {
            cols: [c],
            regions: [regionId],
            cells: empties,
          },
        };
      }
    }
  }
  
  // Try more complex composite shapes: unions of multiple regions
  // intersected with rows or columns
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    // Try pairs of regions
    for (let reg1 = 1; reg1 <= size; reg1 += 1) {
      for (let reg2 = reg1 + 1; reg2 <= size; reg2 += 1) {
        const region1 = regionCells(state, reg1);
        const region2 = regionCells(state, reg2);
        const unionRegions = union(region1, region2);
        
        const shape = intersection(row, unionRegions);
        if (shape.length === 0) continue;
        
        const empties = emptyCells(state, shape);
        if (empties.length === 0) continue;
        
        const shapeStars = countStars(state, shape);
        const reg1Stars = countStars(state, region1);
        const reg2Stars = countStars(state, region2);
        const reg1Remaining = starsPerUnit - reg1Stars;
        const reg2Remaining = starsPerUnit - reg2Stars;
        
        // Calculate cells outside the intersection
        const rowOutsideIntersection = difference(row, shape);
        const unionOutsideIntersection = difference(unionRegions, shape);
        
        // Count empty cells outside the intersection
        const emptyCellsInRowOutside = emptyCells(state, rowOutsideIntersection).length;
        const emptyCellsInUnionOutside = emptyCells(state, unionOutsideIntersection).length;
        
        // The union needs at least max(reg1Remaining, reg2Remaining) stars
        // (the region that needs more must be satisfied)
        // This is a lower bound - the actual need might be higher, but for undercounting
        // we use the most conservative (lowest) estimate
        const unionRemaining = Math.max(reg1Remaining, reg2Remaining);
        
        // Compute minimum stars that MUST be in the intersection
        // This considers that the row/union could get stars from outside the intersection
        const minStarsInIntersection = Math.max(
          0,
          rowRemaining - emptyCellsInRowOutside,
          unionRemaining - emptyCellsInUnionOutside
        );
        
        // If minimum equals the number of empty cells in the intersection,
        // all empty cells must be stars
        if (minStarsInIntersection === empties.length && empties.length > 0) {
          // Validate that placing stars in ALL empty cells doesn't violate constraints
          if (!canPlaceAllStars(state, empties)) {
            continue; // Skip if placing all stars would violate constraints
          }
          
          const explanation = `Row ${r + 1} needs ${rowRemaining} more star(s). Regions ${reg1} and ${reg2} together need at least ${reg1Remaining + reg2Remaining} more star(s). The intersection with row ${r + 1} has exactly ${empties.length} empty cell(s), so all must be stars.`;
          
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'undercounting',
            resultCells: empties, // Return ALL empty cells, not just one
            explanation,
            highlights: {
              rows: [r],
              regions: [reg1, reg2],
              cells: empties,
            },
          };
        }
      }
    }
  }

  return null;
}
