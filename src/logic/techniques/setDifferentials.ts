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
  difference,
  maxStarsWithTwoByTwo,
  getCell,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `set-differentials-${hintCounter}`;
}

/**
 * Set Differentials technique:
 * 
 * TEMPORARILY DISABLED: Like finned-counts, this technique has fundamental logical flaws
 * that cause incorrect deductions. It needs to be redesigned to properly verify that
 * cells are actually FORCED by the logic, not just possible placements.
 * 
 * Identifies pairs of overlapping composite shapes where the difference
 * in their star counts forces specific cells in the symmetric difference.
 * 
 * For example, if shape A must have at least 3 stars and shape B (which
 * contains A) can have at most 4 stars, then the cells in B-A can have
 * at most 1 star.
 * 
 * This technique compares:
 * - Minimum star counts for smaller shapes
 * - Maximum star counts for larger shapes
 * - The symmetric difference between shapes
 */
export function findSetDifferentialsHint(state: PuzzleState): Hint | null {
  // TEMPORARILY DISABLED - see comment above
  return null;
  
  const { size, starsPerUnit } = state.def;

  // Strategy: Compare pairs of overlapping composite shapes
  // Look for cases where shape A ⊆ shape B and the star count
  // difference forces cells in B - A
  
  // Try comparing row-region intersections with larger shapes
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    for (let reg1 = 1; reg1 <= size; reg1 += 1) {
      const region1 = regionCells(state, reg1);
      const reg1Stars = countStars(state, region1);
      const reg1Remaining = starsPerUnit - reg1Stars;
      
      if (reg1Remaining <= 0) continue;
      
      // Shape A: intersection of row and region1
      const shapeA = intersection(row, region1);
      if (shapeA.length === 0) continue;
      
      const shapeAStars = countStars(state, shapeA);
      const shapeAEmpties = emptyCells(state, shapeA);
      
      // Minimum stars needed in shape A
      const minStarsA = Math.max(shapeAStars, rowRemaining, reg1Remaining);
      
      // Now look for a larger shape B that contains shape A
      for (let reg2 = 1; reg2 <= size; reg2 += 1) {
        if (reg2 === reg1) continue;
        
        const region2 = regionCells(state, reg2);
        const reg2Stars = countStars(state, region2);
        const reg2Remaining = starsPerUnit - reg2Stars;
        
        if (reg2Remaining <= 0) continue;
        
        // Shape B: intersection of row and union of region1 and region2
        const unionRegions = union(region1, region2);
        const shapeB = intersection(row, unionRegions);
        
        if (shapeB.length === 0) continue;
        
        // Check if shape A is a subset of shape B
        const aSubsetOfB = shapeA.every((cellA) =>
          shapeB.some((cellB) => cellA.row === cellB.row && cellA.col === cellB.col)
        );
        
        if (!aSubsetOfB) continue;
        
        // Compute the difference B - A
        const diff = difference(shapeB, shapeA);
        if (diff.length === 0) continue;
        
        const diffEmpties = emptyCells(state, diff);
        if (diffEmpties.length === 0) continue;
        
        const diffStars = countStars(state, diff);
        
        // Compute maximum stars in shape B
        const shapeBStars = countStars(state, shapeB);
        const existingStarCoords = shapeB.filter((c) => getCell(state, c) === 'star');
        const maxStarsPossibleB = maxStarsWithTwoByTwo(state, shapeB, existingStarCoords);
        const maxFromUnitsB = Math.min(
          rowRemaining + shapeBStars,
          reg1Remaining + reg2Remaining + shapeBStars
        );
        const maxStarsB = Math.min(maxStarsPossibleB, maxFromUnitsB);
        
        // If minStarsA + diffStars >= maxStarsB, then the difference can have
        // at most (maxStarsB - minStarsA) stars
        const maxStarsInDiff = maxStarsB - minStarsA;
        
        // If maxStarsInDiff equals current stars in diff, all empties must be crosses
        if (maxStarsInDiff === diffStars && diffEmpties.length > 0 && maxStarsInDiff >= 0) {
          const explanation = `Row ${r + 1} ∩ region ${reg1} needs at least ${minStarsA} star(s), and row ${r + 1} ∩ (regions ${reg1} ∪ ${reg2}) can have at most ${maxStarsB} star(s). The difference can have at most ${maxStarsInDiff} star(s), which is already reached, so all ${diffEmpties.length} empty cell(s) in the difference must be crosses.`;
          
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'set-differentials',
            resultCells: diffEmpties,
            explanation,
            highlights: {
              rows: [r],
              regions: [reg1, reg2],
              cells: diffEmpties,
            },
          };
        }
        
        // If minStarsA + diffEmpties + diffStars <= maxStarsB, check for forcing stars
        const minStarsInDiff = Math.max(0, minStarsA + diffStars + diffEmpties.length - maxStarsB);
        
        // If all empties in diff must be stars
        if (minStarsInDiff === diffEmpties.length && diffEmpties.length > 0) {
          const explanation = `Row ${r + 1} ∩ region ${reg1} needs at least ${minStarsA} star(s), and row ${r + 1} ∩ (regions ${reg1} ∪ ${reg2}) can have at most ${maxStarsB} star(s). The difference must have at least ${minStarsInDiff} star(s), which equals the ${diffEmpties.length} empty cell(s), so all must be stars.`;
          
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'set-differentials',
            resultCells: diffEmpties,
            explanation,
            highlights: {
              rows: [r],
              regions: [reg1, reg2],
              cells: diffEmpties,
            },
          };
        }
      }
    }
  }
  
  // Try comparing column-region intersections with larger shapes
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const colStars = countStars(state, col);
    const colRemaining = starsPerUnit - colStars;
    
    if (colRemaining <= 0) continue;
    
    for (let reg1 = 1; reg1 <= size; reg1 += 1) {
      const region1 = regionCells(state, reg1);
      const reg1Stars = countStars(state, region1);
      const reg1Remaining = starsPerUnit - reg1Stars;
      
      if (reg1Remaining <= 0) continue;
      
      // Shape A: intersection of column and region1
      const shapeA = intersection(col, region1);
      if (shapeA.length === 0) continue;
      
      const shapeAStars = countStars(state, shapeA);
      const shapeAEmpties = emptyCells(state, shapeA);
      
      // Minimum stars needed in shape A
      const minStarsA = Math.max(shapeAStars, colRemaining, reg1Remaining);
      
      // Now look for a larger shape B that contains shape A
      for (let reg2 = 1; reg2 <= size; reg2 += 1) {
        if (reg2 === reg1) continue;
        
        const region2 = regionCells(state, reg2);
        const reg2Stars = countStars(state, region2);
        const reg2Remaining = starsPerUnit - reg2Stars;
        
        if (reg2Remaining <= 0) continue;
        
        // Shape B: intersection of column and union of region1 and region2
        const unionRegions = union(region1, region2);
        const shapeB = intersection(col, unionRegions);
        
        if (shapeB.length === 0) continue;
        
        // Check if shape A is a subset of shape B
        const aSubsetOfB = shapeA.every((cellA) =>
          shapeB.some((cellB) => cellA.row === cellB.row && cellA.col === cellB.col)
        );
        
        if (!aSubsetOfB) continue;
        
        // Compute the difference B - A
        const diff = difference(shapeB, shapeA);
        if (diff.length === 0) continue;
        
        const diffEmpties = emptyCells(state, diff);
        if (diffEmpties.length === 0) continue;
        
        const diffStars = countStars(state, diff);
        
        // Compute maximum stars in shape B
        const shapeBStars = countStars(state, shapeB);
        const existingStarCoords = shapeB.filter((c) => getCell(state, c) === 'star');
        const maxStarsPossibleB = maxStarsWithTwoByTwo(state, shapeB, existingStarCoords);
        const maxFromUnitsB = Math.min(
          colRemaining + shapeBStars,
          reg1Remaining + reg2Remaining + shapeBStars
        );
        const maxStarsB = Math.min(maxStarsPossibleB, maxFromUnitsB);
        
        // If minStarsA + diffStars >= maxStarsB, then the difference can have
        // at most (maxStarsB - minStarsA) stars
        const maxStarsInDiff = maxStarsB - minStarsA;
        
        // If maxStarsInDiff equals current stars in diff, all empties must be crosses
        if (maxStarsInDiff === diffStars && diffEmpties.length > 0 && maxStarsInDiff >= 0) {
          const explanation = `Column ${c + 1} ∩ region ${reg1} needs at least ${minStarsA} star(s), and column ${c + 1} ∩ (regions ${reg1} ∪ ${reg2}) can have at most ${maxStarsB} star(s). The difference can have at most ${maxStarsInDiff} star(s), which is already reached, so all ${diffEmpties.length} empty cell(s) in the difference must be crosses.`;
          
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'set-differentials',
            resultCells: diffEmpties,
            explanation,
            highlights: {
              cols: [c],
              regions: [reg1, reg2],
              cells: diffEmpties,
            },
          };
        }
        
        // If minStarsA + diffEmpties + diffStars <= maxStarsB, check for forcing stars
        const minStarsInDiff = Math.max(0, minStarsA + diffStars + diffEmpties.length - maxStarsB);
        
        // If all empties in diff must be stars
        if (minStarsInDiff === diffEmpties.length && diffEmpties.length > 0) {
          const explanation = `Column ${c + 1} ∩ region ${reg1} needs at least ${minStarsA} star(s), and column ${c + 1} ∩ (regions ${reg1} ∪ ${reg2}) can have at most ${maxStarsB} star(s). The difference must have at least ${minStarsInDiff} star(s), which equals the ${diffEmpties.length} empty cell(s), so all must be stars.`;
          
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'set-differentials',
            resultCells: diffEmpties,
            explanation,
            highlights: {
              cols: [c],
              regions: [reg1, reg2],
              cells: diffEmpties,
            },
          };
        }
      }
    }
  }

  return null;
}
