import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findLShapes } from '../src/logic/helpers';

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

describe('Debug L-Shape Logic', () => {
  it('should trace through the L-shape logic for region 7', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const lShapes = findLShapes(state);
    const region7 = lShapes.find(s => s.regionId === 7);
    
    if (!region7) {
      console.log('Region 7 not found as L-shape!');
      return;
    }

    console.log('\n=== REGION 7 L-SHAPE ANALYSIS ===\n');
    console.log('Corner:', `[${region7.corner.row},${region7.corner.col}]`);
    console.log('Horizontal arm:', region7.arms.horizontal.map(c => `[${c.row},${c.col}]`).join(', '));
    console.log('Vertical arm:', region7.arms.vertical.map(c => `[${c.row},${c.col}]`).join(', '));
    
    const { corner, arms } = region7;
    
    console.log('\n=== CHECKING ADJACENCY ===\n');
    
    // Check the logic I added
    if (arms.horizontal.length === 1 && arms.vertical.length === 2) {
      console.log('✓ Pattern matches: 1 horizontal, 2 vertical');
      
      const vert0 = arms.vertical[0];
      const vert1 = arms.vertical[1];
      const horiz0 = arms.horizontal[0];
      
      console.log(`\nvert0: [${vert0.row},${vert0.col}]`);
      console.log(`vert1: [${vert1.row},${vert1.col}]`);
      console.log(`horiz0: [${horiz0.row},${horiz0.col}]`);
      console.log(`corner: [${corner.row},${corner.col}]`);
      
      const cornerAdjacentToVert0 = Math.abs(corner.row - vert0.row) <= 1 && Math.abs(corner.col - vert0.col) <= 1;
      const cornerAdjacentToVert1 = Math.abs(corner.row - vert1.row) <= 1 && Math.abs(corner.col - vert1.col) <= 1;
      
      console.log(`\nCorner adjacent to vert0? ${cornerAdjacentToVert0}`);
      console.log(`  Distance: row=${Math.abs(corner.row - vert0.row)}, col=${Math.abs(corner.col - vert0.col)}`);
      console.log(`Corner adjacent to vert1? ${cornerAdjacentToVert1}`);
      console.log(`  Distance: row=${Math.abs(corner.row - vert1.row)}, col=${Math.abs(corner.col - vert1.col)}`);
      
      if (cornerAdjacentToVert0 && !cornerAdjacentToVert1) {
        console.log('\n✓ Would place stars at horiz0 and vert1');
        console.log(`  Stars: [${horiz0.row},${horiz0.col}] and [${vert1.row},${vert1.col}]`);
      } else if (cornerAdjacentToVert1 && !cornerAdjacentToVert0) {
        console.log('\n✓ Would place stars at horiz0 and vert0');
        console.log(`  Stars: [${horiz0.row},${horiz0.col}] and [${vert0.row},${vert0.col}]`);
      } else {
        console.log('\n✗ Neither condition met!');
      }
    } else {
      console.log('✗ Pattern does NOT match: 1 horizontal, 2 vertical');
      console.log(`  Horizontal: ${arms.horizontal.length}, Vertical: ${arms.vertical.length}`);
    }
    
    console.log('\n=== EXPECTED RESULT ===');
    console.log('Should place stars at: [4,6] and [6,5]');
    console.log('\nWhy?');
    console.log('  Corner [4,5] is adjacent to [5,5] (diagonal)');
    console.log('  So [4,5] and [5,5] cannot both be stars');
    console.log('  Horizontal arm needs 1 star: must be [4,6]');
    console.log('  Vertical arm needs 1 star: must be [6,5] (since [5,5] is excluded)');
  });
});
