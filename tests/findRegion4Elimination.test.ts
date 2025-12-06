import { describe, it } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { computeStats, allConstraints } from '../src/logic/stats';
import type { Constraint } from '../src/logic/stats';

function parsePuzzle(puzzleStr: string): PuzzleState {
  const lines = puzzleStr.trim().split('\n').map((line) => line.trim());
  const regions: number[][] = [];
  const stars: Array<[number, number]> = [];
  const crosses: Array<[number, number]> = [];

  for (let r = 0; r < lines.length; r += 1) {
    const cells = lines[r].split(/\s+/);
    const regionRow: number[] = [];

    for (let c = 0; c < cells.length; c += 1) {
      const match = cells[c].match(/^(\d+)([xs]?)$/);
      if (!match) {
        throw new Error(`Invalid cell ${cells[c]} at (${r}, ${c})`);
      }
      const regionId = Number(match[1]) + 1;
      const state = match[2];

      regionRow.push(regionId);
      if (state === 's') {
        stars.push([r, c]);
      } else if (state === 'x') {
        crosses.push([r, c]);
      }
    }

    regions.push(regionRow);
  }

  const state = createEmptyPuzzleState({
    size: lines.length,
    starsPerUnit: 2,
    regions,
  });

  for (const [row, col] of stars) {
    state.cells[row][col] = 'star';
  }
  for (const [row, col] of crosses) {
    state.cells[row][col] = 'cross';
  }

  return state;
}

const INITIAL_STATE = `0x 0x 0x 0x 0s 1x 1 1 1 1
2 2x 2s 0x 1x 1x 1 1 1 3
2 2x 0x 0x 1 3 3 3 3 3
4x 4x 0s 4x 3 3 3x 3 3x 8
4x 4x 0x 4x 3x 3 3 7 7x 8
5x 4s 4x 4s 6x 6x 7x 7x 8x 8x
5x 6x 4x 6x 6x 6 6 7 7x 8
5s 6x 6x 6 7 7x 7x 7 8 8
5x 5x 5x 6 6x 7 9 9 9 9
5x 5s 6x 6 9 9 9 9 9 9`;

describe('Find Region 4 Elimination Logic', () => {
  it('should identify why (3,7) and (4,6) should be eliminated', () => {
    const state = parsePuzzle(INITIAL_STATE);
    const stats = computeStats(state);
    const constraints = allConstraints(stats);

    // Expected eliminations
    const expectedElims = [
      { row: 3, col: 7 },
      { row: 4, col: 6 },
    ];

    console.log('\n=== Row 3 and Row 4 constraints ===');
    const row3 = constraints.find(c => c.source === 'row' && c.description.includes('Row 3'));
    const row4 = constraints.find(c => c.source === 'row' && c.description.includes('Row 4'));
    
    if (row3) {
      console.log(`Row 3: ${row3.description}`);
      console.log(`  minStars: ${row3.minStars}, maxStars: ${row3.maxStars}`);
      console.log(`  cells: ${row3.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
      const region4InRow3 = row3.cells.filter(c => state.def.regions[c.row][c.col] === 4);
      console.log(`  Region 4 cells in row 3: ${region4InRow3.map(c => `(${c.row},${c.col})`).join(', ')}`);
    }
    
    if (row4) {
      console.log(`Row 4: ${row4.description}`);
      console.log(`  minStars: ${row4.minStars}, maxStars: ${row4.maxStars}`);
      console.log(`  cells: ${row4.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
      const region4InRow4 = row4.cells.filter(c => state.def.regions[c.row][c.col] === 4);
      console.log(`  Region 4 cells in row 4: ${region4InRow4.map(c => `(${c.row},${c.col})`).join(', ')}`);
    }

    console.log('\n=== Region D rows 3-4 constraint ===');
    const regionD34 = constraints.find(c => 
      c.source === 'region-band' && c.description.includes('Region D rows 3–4')
    );
    if (regionD34) {
      console.log(`Region D rows 3-4: ${regionD34.description}`);
      console.log(`  minStars: ${regionD34.minStars}, maxStars: ${regionD34.maxStars}`);
      console.log(`  cells: ${regionD34.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    }

    console.log('\n=== Looking for constraint that forces stars into subset ===');
    // Check if row 3 + row 4 together force stars into a smaller subset
    if (row3 && row4 && regionD34) {
      // Row 3 needs 1 star, Row 4 needs 2 stars
      // Region D rows 3-4 has 5 cells: (3,4), (3,5), (3,7), (4,5), (4,6)
      // If row 3's 1 star must be in region 4, and row 4's 2 stars must be in region 4,
      // then we need 3 stars total in region 4 rows 3-4
      // But region 4 only needs 2 stars total!
      
      const region4Total = constraints.find(c => 
        c.source === 'region' && c.description.includes('Region D')
      );
      
      if (region4Total) {
        console.log(`Region D total: ${region4Total.description}`);
        console.log(`  minStars: ${region4Total.minStars}, maxStars: ${region4Total.maxStars}`);
        console.log(`  cells: ${region4Total.cells.length}`);
        
        // Check: if region 4 needs 2 stars total, and rows 3-4 have 5 candidates,
        // but row 3 needs 1 and row 4 needs 2 (total 3), then something is wrong
        // unless some stars are already placed or some cells are eliminated
        
        // Actually, let's check what stars are already in region 4
        let starsInRegion4 = 0;
        for (let r = 0; r < state.def.size; r += 1) {
          for (let c = 0; c < state.def.size; c += 1) {
            if (state.def.regions[r][c] === 4 && state.cells[r][c] === 'star') {
              starsInRegion4 += 1;
              console.log(`  Star already placed at (${r},${c})`);
            }
          }
        }
        console.log(`  Stars already in region 4: ${starsInRegion4}`);
        console.log(`  Remaining needed: ${region4Total.minStars - starsInRegion4}`);
      }
    }

    // Check if there's a 2x2 block that intersects with region D rows 3-4
    console.log('\n=== 2x2 blocks in region D rows 3-4 ===');
    const blocksInRegionD34 = constraints.filter(c => 
      c.source === 'block' || c.source === 'block-forced'
    ).filter(c => {
      const regionD34Set = new Set(regionD34?.cells.map(cell => `${cell.row},${cell.col}`) || []);
      return c.cells.some(cell => regionD34Set.has(`${cell.row},${cell.col}`));
    });
    
    blocksInRegionD34.forEach((block, i) => {
      const intersection = block.cells.filter(c => {
        const regionD34Set = new Set(regionD34?.cells.map(cell => `${cell.row},${cell.col}`) || []);
        return regionD34Set.has(`${c.row},${c.col}`);
      });
      if (intersection.length > 0) {
        console.log(`${i}: ${block.description}`);
        console.log(`  minStars: ${block.minStars}, maxStars: ${block.maxStars}`);
        console.log(`  All cells: ${block.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
        console.log(`  Intersection with region D 3-4: ${intersection.map(c => `(${c.row},${c.col})`).join(', ')}`);
      }
    });
  });
});

