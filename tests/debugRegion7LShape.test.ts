import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findSimpleShapesHint } from '../src/logic/techniques/simpleShapes';
import { regionCells, emptyCells, countStars } from '../src/logic/helpers';

const EXAMPLE_REGIONS = [
  [10, 10, 10, 1, 1, 1, 2, 2, 3, 3],
  [10, 10, 10, 1, 1, 1, 2, 2, 3, 3],
  [4, 4, 10, 10, 1, 2, 2, 2, 2, 3],
  [4, 10, 10, 10, 1, 2, 2, 3, 2, 3],
  [4, 10, 5, 10, 1, 7, 7, 3, 3, 3],
  [4, 10, 5, 1, 1, 7, 3, 3, 9, 3],
  [4, 5, 5, 5, 1, 7, 3, 8, 9, 3],
  [4, 4, 5, 5, 5, 5, 5, 8, 9, 9],
  [4, 4, 6, 6, 6, 5, 5, 8, 9, 9],
  [6, 6, 6, 5, 5, 5, 5, 8, 9, 9],
];

describe('Debug Region 7 L-Shape', () => {
  it('should analyze why region 7 L-shape stars are not found', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    console.log('\n=== REGION 7 ANALYSIS ===\n');
    
    const region7 = regionCells(state, 7);
    console.log('Region 7 cells (0-indexed):');
    region7.forEach(c => {
      console.log(`  [${c.row},${c.col}]`);
    });
    
    console.log('\nVisualization:');
    console.log('  Row 4: [4,5] [4,6]');
    console.log('  Row 5: [5,5]');
    console.log('  Row 6: [6,5]');
    console.log('\nThis forms an L-shape!');
    
    console.log('\nExpected stars: [4,6] and [6,5]');
    console.log('Why? Because:');
    console.log('  - The horizontal part [4,5], [4,6] can have at most 1 star (2x2 constraint)');
    console.log('  - The vertical part [5,5], [6,5] can have at most 1 star (adjacent constraint)');
    console.log('  - We need 2 stars total');
    console.log('  - So we need exactly 1 star in each part');
    console.log('  - [4,5] and [5,5] are adjacent, so they can\'t both be stars');
    console.log('  - Therefore: [4,6] must be a star (only option in horizontal part)');
    console.log('  - And [6,5] must be a star (only option in vertical part after [5,5] is excluded)');
    
    console.log('\n=== CHECKING SIMPLE-SHAPES HINT ===\n');
    const hint = findSimpleShapesHint(state);
    
    if (hint) {
      console.log('Simple-shapes hint found:');
      console.log(`  Kind: ${hint.kind}`);
      console.log(`  Cells:`, hint.resultCells.map(c => `[${c.row},${c.col}]`).join(', '));
      console.log(`  Explanation: ${hint.explanation}`);
      
      // Check if it's placing stars in region 7
      const region7Cells = hint.resultCells.filter(c => EXAMPLE_REGIONS[c.row][c.col] === 7);
      if (region7Cells.length > 0) {
        console.log('\n  ✓ Hint affects region 7');
      } else {
        console.log('\n  ✗ Hint does NOT affect region 7');
      }
    } else {
      console.log('No simple-shapes hint found');
    }
    
    console.log('\n=== CHECKING IF SIMPLE-SHAPES RECOGNIZES L-SHAPES ===\n');
    console.log('The simple-shapes technique should recognize L-shapes and place definitive stars.');
    console.log('An L-shape with 4 cells needs 2 stars, and due to adjacency/2x2 constraints,');
    console.log('the placement is often forced.');
  });
});
