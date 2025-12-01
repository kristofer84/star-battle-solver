import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  intersection,
  getCell,
  maxStarsWithTwoByTwo,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `finned-counts-${hintCounter}`;
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
  const { size, starsPerUnit } = state.def;

  // Strategy: Look for composite shapes where a counting argument almost works
  // but fails due to a small number of "fin" cells
  
  // Try row-region intersections with potential fins
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
      if (empties.length <= 2) continue; // Need at least 3 cells for a fin pattern
      
      const minStarsNeeded = Math.max(rowRemaining, regionRemaining);
      
      // Check if this is a finned pattern:
      // The minimum stars needed is MORE than what we have, but only by 1
      // and there are more empty cells than needed
      if (minStarsNeeded === empties.length - 1 && empties.length >= 2) {
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
          if (case2Needed === nonFinCells.length && nonFinCells.length > 0) {
            const explanation = `Row ${r + 1} needs ${rowRemaining} more star(s) and region ${regionId} needs ${regionRemaining} more star(s). Their intersection has ${empties.length} empty cells. Using a finned counting argument with cell (${finCell.row + 1},${finCell.col + 1}) as the fin: if the fin is a cross, then all ${nonFinCells.length} remaining cells must be stars. If the fin is a star, at least ${case1Needed} of the remaining cells must be stars.`;
            
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
    
    for (let regionId = 1; regionId <= size; regionId += 1) {
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
      
      if (minStarsNeeded === empties.length - 1 && empties.length >= 2) {
        for (let finIdx = 0; finIdx < empties.length; finIdx += 1) {
          const finCell = empties[finIdx];
          const nonFinCells = empties.filter((_, idx) => idx !== finIdx);
          
          const case2Needed = minStarsNeeded;
          
          if (case2Needed === nonFinCells.length && nonFinCells.length > 0) {
            const explanation = `Column ${c + 1} needs ${colRemaining} more star(s) and region ${regionId} needs ${regionRemaining} more star(s). Their intersection has ${empties.length} empty cells. Using a finned counting argument with cell (${finCell.row + 1},${finCell.col + 1}) as the fin: if the fin is a cross, then all ${nonFinCells.length} remaining cells must be stars.`;
            
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
    
    for (let regionId = 1; regionId <= size; regionId += 1) {
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      const shape = intersection(row, region);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length <= 2) continue;
      
      const shapeStars = countStars(state, shape);
      const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
      const maxStarsPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
      
      // Check for finned overcounting: max is reached except for a fin
      const maxFromUnits = Math.min(rowRemaining + shapeStars, regionRemaining + shapeStars);
      const maxStars = Math.min(maxStarsPossible, maxFromUnits);
      
      // If max is one less than current empties + stars, we have a finned pattern
      if (maxStars === shapeStars + empties.length - 1 && empties.length >= 2) {
        // Try each cell as a potential fin
        for (let finIdx = 0; finIdx < empties.length; finIdx += 1) {
          const finCell = empties[finIdx];
          const nonFinCells = empties.filter((_, idx) => idx !== finIdx);
          
          // If fin is a star, then all non-fin cells must be crosses
          // If fin is a cross, then we can place at most (maxStars - shapeStars) stars in non-fin cells
          
          if (nonFinCells.length > 0) {
            const explanation = `Row ${r + 1} and region ${regionId} can have at most ${maxStars} star(s) in their intersection. Using a finned overcounting argument with cell (${finCell.row + 1},${finCell.col + 1}) as the fin: if the fin is a star, then all ${nonFinCells.length} remaining cells must be crosses.`;
            
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
