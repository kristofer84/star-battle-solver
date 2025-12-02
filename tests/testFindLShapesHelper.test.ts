import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findLShapes, regionCells } from '../src/logic/helpers';

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

describe('Test findLShapes Helper', () => {
  it('should find region 7 as an L-shape', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    console.log('\n=== TESTING findLShapes HELPER ===\n');
    
    const region7 = regionCells(state, 7);
    console.log('Region 7 cells:', region7.map(c => `[${c.row},${c.col}]`).join(', '));
    console.log('Region 7 cell count:', region7.length);
    
    const lShapes = findLShapes(state);
    console.log('\nL-shapes found:', lShapes.length);
    
    lShapes.forEach(shape => {
      console.log(`\nRegion ${shape.regionId}:`);
      console.log(`  Cells:`, shape.cells.map(c => `[${c.row},${c.col}]`).join(', '));
      console.log(`  Corner: [${shape.corner.row},${shape.corner.col}]`);
      console.log(`  Horizontal arm:`, shape.arms.horizontal.map(c => `[${c.row},${c.col}]`).join(', '));
      console.log(`  Vertical arm:`, shape.arms.vertical.map(c => `[${c.row},${c.col}]`).join(', '));
    });
    
    const region7LShape = lShapes.find(shape => shape.regionId === 7);
    if (region7LShape) {
      console.log('\n✓ Region 7 IS recognized as an L-shape!');
    } else {
      console.log('\n✗ Region 7 is NOT recognized as an L-shape!');
      console.log('\nDebugging why:');
      
      // Manually check the logic
      for (const corner of region7) {
        const horizontal = region7.filter(c => c.row === corner.row && c.col !== corner.col);
        const vertical = region7.filter(c => c.col === corner.col && c.row !== corner.row);
        
        console.log(`\n  Trying corner [${corner.row},${corner.col}]:`);
        console.log(`    Horizontal arm (same row ${corner.row}):`, horizontal.map(c => `[${c.row},${c.col}]`).join(', '));
        console.log(`    Vertical arm (same col ${corner.col}):`, vertical.map(c => `[${c.row},${c.col}]`).join(', '));
        
        if (horizontal.length > 0 && vertical.length > 0) {
          const lShapeCells = [corner, ...horizontal, ...vertical];
          console.log(`    L-shape cells: ${lShapeCells.length}`);
          console.log(`    Region cells: ${region7.length}`);
          console.log(`    Match? ${lShapeCells.length === region7.length}`);
        }
      }
    }
    
    expect(region7LShape).toBeDefined();
  });
});
