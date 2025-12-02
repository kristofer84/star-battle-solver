import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { regionCells, emptyCells, countStars } from '../src/logic/helpers';
import type { PuzzleState } from '../src/types/puzzle';

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

const EXPECTED_STARS: [number, number][] = [
  [0, 3], [0, 6],
  [1, 1], [1, 8],
  [2, 3], [2, 5],
  [3, 0], [3, 9],
  [4, 4], [4, 6],
  [5, 2], [5, 8],
  [6, 0], [6, 5],
  [7, 2], [7, 7],
  [8, 4], [8, 9],
  [9, 1], [9, 7],
];

describe('Find L-Shape Stars', () => {
  it('should identify which regions are L-shapes and where their stars are', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    console.log('\n=== ANALYZING ALL REGIONS ===\n');
    
    const expectedStarsByRegion = new Map<number, [number, number][]>();
    for (const [r, c] of EXPECTED_STARS) {
      const regionId = EXAMPLE_REGIONS[r][c];
      if (!expectedStarsByRegion.has(regionId)) {
        expectedStarsByRegion.set(regionId, []);
      }
      expectedStarsByRegion.get(regionId)!.push([r, c]);
    }
    
    for (let regionId = 1; regionId <= 10; regionId++) {
      const region = regionCells(state, regionId);
      const empties = emptyCells(state, region);
      const stars = countStars(state, region);
      
      console.log(`\nRegion ${regionId}:`);
      console.log(`  Total cells: ${region.length}`);
      console.log(`  Empty cells: ${empties.length}`);
      console.log(`  Current stars: ${stars}`);
      console.log(`  Cells:`, region.map(c => `[${c.row},${c.col}]`).join(', '));
      
      const expectedStars = expectedStarsByRegion.get(regionId) || [];
      console.log(`  Expected stars:`, expectedStars.map(([r, c]) => `[${r},${c}]`).join(', '));
      
      // Check if this is an L-shape (7 cells in a specific pattern)
      if (region.length === 7) {
        console.log(`  ⚠️  This is an L-shape!`);
        
        // For L-shapes, check if there's a definitive star placement
        // An L-shape has 7 cells and needs 2 stars
        // If we can identify cells that MUST have stars due to constraints, that's definitive
        
        // Check the shape
        const rows = [...new Set(region.map(c => c.row))];
        const cols = [...new Set(region.map(c => c.col))];
        console.log(`  Spans rows: ${rows.map(r => r).join(', ')} (0-indexed)`);
        console.log(`  Spans cols: ${cols.map(c => c).join(', ')} (0-indexed)`);
      }
    }
    
    console.log('\n\n=== LOOKING FOR DEFINITIVE STARS ===\n');
    console.log('A definitive star is one that can be placed immediately due to simple constraints.');
    console.log('For example, in an L-shape, if one arm of the L can only fit 1 star,');
    console.log('and the other arm can only fit 1 star, then we know exactly where they go.');
  });
});
