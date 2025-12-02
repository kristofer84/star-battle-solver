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
  maxStarsWithTwoByTwo,
  getCell,
  formatRow,
  formatCol,
  formatRegions,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `overcounting-${hintCounter}`;
}

/**
 * Overcounting technique:
 * 
 * Identifies composite shapes (unions of regions or partial regions) where
 * the maximum number of stars that can be placed has been reached,
 * forcing all remaining empty cells to be crosses.
 * 
 * The maximum star count considers:
 * - Stars already placed in the shape
 * - 2×2 constraints that limit placement
 * - Adjacency rules
 * - Unit quotas that constrain total stars
 */
export function findOvercountingHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Strategy: Look for composite shapes formed by intersections of units
  // where the maximum star count has been reached, forcing remaining cells to be crosses
  
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
      
      // Compute maximum stars that can be placed in this shape
      const shapeStars = countStars(state, shape);
      const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
      const maxStarsPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
      
      // The maximum is also constrained by unit quotas
      const maxFromUnits = Math.min(rowRemaining + shapeStars, regionRemaining + shapeStars);
      const maxStars = Math.min(maxStarsPossible, maxFromUnits);
      
      // If maximum equals current stars, all empty cells must be crosses
      if (maxStars === shapeStars && empties.length > 0) {
        const explanation = `${formatRow(r)} and region ${formatRegions([regionId])} can have at most ${maxStars} star(s) in their intersection (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
        
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'overcounting',
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
      
      // Compute maximum stars that can be placed in this shape
      const shapeStars = countStars(state, shape);
      const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
      const maxStarsPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
      
      // The maximum is also constrained by unit quotas
      const maxFromUnits = Math.min(colRemaining + shapeStars, regionRemaining + shapeStars);
      const maxStars = Math.min(maxStarsPossible, maxFromUnits);
      
      // If maximum equals current stars, all empty cells must be crosses
      if (maxStars === shapeStars && empties.length > 0) {
        const explanation = `${formatCol(c)} and region ${formatRegions([regionId])} can have at most ${maxStars} star(s) in their intersection (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
        
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'overcounting',
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
        const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
        const maxStarsPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
        
        const reg1Stars = countStars(state, region1);
        const reg2Stars = countStars(state, region2);
        const reg1Remaining = starsPerUnit - reg1Stars;
        const reg2Remaining = starsPerUnit - reg2Stars;
        
        // Maximum from unit quotas
        const maxFromUnits = Math.min(
          rowRemaining + shapeStars,
          reg1Remaining + reg2Remaining + shapeStars
        );
        const maxStars = Math.min(maxStarsPossible, maxFromUnits);
        
        // If maximum equals current stars, all empty cells must be crosses
        if (maxStars === shapeStars && empties.length > 0) {
          const explanation = `${formatRow(r)} intersected with ${formatRegions([reg1, reg2])} can have at most ${maxStars} star(s) (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
          
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'overcounting',
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
