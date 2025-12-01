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
} from '../helpers';

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
      
      // Compute minimum stars needed in this shape
      const shapeStars = countStars(state, shape);
      const minStarsNeeded = Math.max(
        rowRemaining,
        regionRemaining,
        shapeStars
      );
      
      // If minimum equals the number of cells in the shape,
      // all empty cells must be stars
      if (minStarsNeeded === empties.length + shapeStars && empties.length > 0) {
        const explanation = `Row ${r + 1} needs ${rowRemaining} more star(s) and region ${regionId} needs ${regionRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'undercounting',
          resultCells: empties,
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
      
      // Compute minimum stars needed in this shape
      const shapeStars = countStars(state, shape);
      const minStarsNeeded = Math.max(
        colRemaining,
        regionRemaining,
        shapeStars
      );
      
      // If minimum equals the number of cells in the shape,
      // all empty cells must be stars
      if (minStarsNeeded === empties.length + shapeStars && empties.length > 0) {
        const explanation = `Column ${c + 1} needs ${colRemaining} more star(s) and region ${regionId} needs ${regionRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'undercounting',
          resultCells: empties,
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
        
        // Minimum stars needed is at least what the row needs
        // and at least what each region needs
        const minStarsNeeded = Math.max(
          rowRemaining,
          reg1Remaining + reg2Remaining - (shapeStars - countStars(state, intersection(region1, region2))),
          shapeStars
        );
        
        if (minStarsNeeded === empties.length + shapeStars && empties.length > 0) {
          const explanation = `Row ${r + 1} needs ${rowRemaining} more star(s). Regions ${reg1} and ${reg2} together need at least ${reg1Remaining + reg2Remaining} more star(s). The intersection with row ${r + 1} has exactly ${empties.length} empty cell(s), so all must be stars.`;
          
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'undercounting',
            resultCells: empties,
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
