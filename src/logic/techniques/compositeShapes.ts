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
  maxStarsWithTwoByTwo,
  getCell,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `composite-shapes-${hintCounter}`;
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

  // Strategy: Look for composite shapes formed by unions of multiple regions
  // that intersect with rows or columns in interesting ways
  
  // Try unions of 2-3 regions
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
      
      // Check if this composite shape forces any cells
      const hint = analyzeCompositeShape(
        state,
        unionRegions,
        [reg1, reg2],
        reg1Remaining + reg2Remaining,
        `regions ${reg1} and ${reg2}`
      );
      if (hint) return hint;
      
      // Try intersecting with rows
      for (let r = 0; r < size; r += 1) {
        const row = rowCells(state, r);
        const rowStars = countStars(state, row);
        const rowRemaining = starsPerUnit - rowStars;
        
        if (rowRemaining <= 0) continue;
        
        const shape = intersection(row, unionRegions);
        if (shape.length === 0) continue;
        
        const empties = emptyCells(state, shape);
        if (empties.length === 0) continue;
        
        // Compute bounds for this composite shape
        const shapeStars = countStars(state, shape);
        const minNeeded = Math.max(rowRemaining, reg1Remaining + reg2Remaining);
        
        // Check for undercounting: min equals empties + existing
        if (minNeeded === empties.length + shapeStars && empties.length > 0) {
          const explanation = `Row ${r + 1} needs ${rowRemaining} more star(s), and regions ${reg1} and ${reg2} together need ${reg1Remaining + reg2Remaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
          
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'composite-shapes',
            resultCells: empties,
            explanation,
            highlights: {
              rows: [r],
              regions: [reg1, reg2],
              cells: empties,
            },
          };
        }
        
        // Check for overcounting: max equals existing
        const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
        const maxPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
        const maxFromUnits = Math.min(
          rowRemaining + shapeStars,
          reg1Remaining + reg2Remaining + shapeStars
        );
        const maxStars = Math.min(maxPossible, maxFromUnits);
        
        if (maxStars === shapeStars && empties.length > 0) {
          const explanation = `Row ${r + 1} intersected with regions ${reg1} and ${reg2} can have at most ${maxStars} star(s) (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
          
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'composite-shapes',
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
      
      // Try intersecting with columns
      for (let c = 0; c < size; c += 1) {
        const col = colCells(state, c);
        const colStars = countStars(state, col);
        const colRemaining = starsPerUnit - colStars;
        
        if (colRemaining <= 0) continue;
        
        const shape = intersection(col, unionRegions);
        if (shape.length === 0) continue;
        
        const empties = emptyCells(state, shape);
        if (empties.length === 0) continue;
        
        // Compute bounds for this composite shape
        const shapeStars = countStars(state, shape);
        const minNeeded = Math.max(colRemaining, reg1Remaining + reg2Remaining);
        
        // Check for undercounting: min equals empties + existing
        if (minNeeded === empties.length + shapeStars && empties.length > 0) {
          const explanation = `Column ${c + 1} needs ${colRemaining} more star(s), and regions ${reg1} and ${reg2} together need ${reg1Remaining + reg2Remaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
          
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'composite-shapes',
            resultCells: empties,
            explanation,
            highlights: {
              cols: [c],
              regions: [reg1, reg2],
              cells: empties,
            },
          };
        }
        
        // Check for overcounting: max equals existing
        const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
        const maxPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
        const maxFromUnits = Math.min(
          colRemaining + shapeStars,
          reg1Remaining + reg2Remaining + shapeStars
        );
        const maxStars = Math.min(maxPossible, maxFromUnits);
        
        if (maxStars === shapeStars && empties.length > 0) {
          const explanation = `Column ${c + 1} intersected with regions ${reg1} and ${reg2} can have at most ${maxStars} star(s) (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
          
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'composite-shapes',
            resultCells: empties,
            explanation,
            highlights: {
              cols: [c],
              regions: [reg1, reg2],
              cells: empties,
            },
          };
        }
      }
    }
  }
  
  // Try unions of 3 regions (more complex patterns)
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
          const row = rowCells(state, r);
          const rowStars = countStars(state, row);
          const rowRemaining = starsPerUnit - rowStars;
          
          if (rowRemaining <= 0) continue;
          
          const shape = intersection(row, unionRegions);
          if (shape.length === 0) continue;
          
          const empties = emptyCells(state, shape);
          if (empties.length === 0) continue;
          
          const shapeStars = countStars(state, shape);
          const minNeeded = Math.max(rowRemaining, totalRemaining);
          
          // Check for undercounting
          if (minNeeded === empties.length + shapeStars && empties.length > 0) {
            const explanation = `Row ${r + 1} needs ${rowRemaining} more star(s), and regions ${reg1}, ${reg2}, and ${reg3} together need ${totalRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
            
            return {
              id: nextHintId(),
              kind: 'place-star',
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
          
          // Check for overcounting
          const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
          const maxPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
          const maxFromUnits = Math.min(
            rowRemaining + shapeStars,
            totalRemaining + shapeStars
          );
          const maxStars = Math.min(maxPossible, maxFromUnits);
          
          if (maxStars === shapeStars && empties.length > 0) {
            const explanation = `Row ${r + 1} intersected with regions ${reg1}, ${reg2}, and ${reg3} can have at most ${maxStars} star(s) (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
            
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
    const explanation = `The composite shape formed by ${shapeDescription} needs ${minStarsNeeded} star(s) and has exactly ${empties.length} empty cell(s), so all must be stars.`;
    
    return {
      id: nextHintId(),
      kind: 'place-star',
      technique: 'composite-shapes',
      resultCells: empties,
      explanation,
      highlights: {
        regions: regionIds,
        cells: empties,
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
