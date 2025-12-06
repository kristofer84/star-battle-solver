import { describe, it } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { computeStats, allConstraints } from '../src/logic/stats';

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

describe('Debug Block Constraints', () => {
  it('should check why block at rows 3-4, cols 4-5 does not have minStars > 0', () => {
    const state = parsePuzzle(INITIAL_STATE);
    const stats = computeStats(state);
    const constraints = allConstraints(stats);

    // Find the block at rows 3-4, cols 4-5
    const block = constraints.find(c => 
      c.description.includes('rows 3–4') && c.description.includes('cols 4–5')
    );

    console.log('\n=== Block at rows 3-4, cols 4-5 ===');
    if (block) {
      console.log(`Description: ${block.description}`);
      console.log(`Source: ${block.source}`);
      console.log(`minStars: ${block.minStars}, maxStars: ${block.maxStars}`);
      console.log(`Cells: ${block.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    } else {
      console.log('Block not found!');
    }

    // Check row 3 and row 4 constraints
    const row3 = constraints.find(c => c.source === 'row' && c.description.includes('Row 3'));
    const row4 = constraints.find(c => c.source === 'row' && c.description.includes('Row 4'));

    console.log('\n=== Row constraints ===');
    if (row3) {
      console.log(`Row 3: ${row3.description}`);
      console.log(`  minStars: ${row3.minStars}, maxStars: ${row3.maxStars}`);
      console.log(`  cells: ${row3.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    }
    if (row4) {
      console.log(`Row 4: ${row4.description}`);
      console.log(`  minStars: ${row4.minStars}, maxStars: ${row4.maxStars}`);
      console.log(`  cells: ${row4.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    }

    // Check region D constraint
    const regionD = constraints.find(c => 
      c.source === 'region' && c.description.includes('Region D')
    );

    console.log('\n=== Region D constraint ===');
    if (regionD) {
      console.log(`Region D: ${regionD.description}`);
      console.log(`  minStars: ${regionD.minStars}, maxStars: ${regionD.maxStars}`);
      console.log(`  cells: ${regionD.cells.length}`);
    }

    // Check region D rows 3-4 constraint
    const regionD34 = constraints.find(c => 
      c.source === 'region-band' && c.description.includes('Region D rows 3–4')
    );

    console.log('\n=== Region D rows 3-4 constraint ===');
    if (regionD34) {
      console.log(`Region D rows 3-4: ${regionD34.description}`);
      console.log(`  minStars: ${regionD34.minStars}, maxStars: ${regionD34.maxStars}`);
      console.log(`  cells: ${regionD34.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    }

    // The expected eliminations are (3,7) and (4,6)
    // These are in region D rows 3-4 but not in the block at cols 4-5
    // If the block at cols 4-5 had minStars > 0, and region D rows 3-4 had maxStars matching,
    // then we could eliminate (3,7) and (4,6)
    
    // Check for forced blocks from bands
    const forcedBlocks = constraints.filter(c => 
      c.source === 'block-forced' && c.description.includes('Region D')
    );
    
    console.log('\n=== Forced blocks for Region D ===');
    forcedBlocks.forEach((fb, i) => {
      console.log(`${i}: ${fb.description}`);
      console.log(`  minStars: ${fb.minStars}, maxStars: ${fb.maxStars}`);
      console.log(`  cells: ${fb.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    });
    
    // Check if there's a forced block at rows 3-4, cols 4-5
    const forcedBlock345 = constraints.find(c => 
      c.source === 'block-forced' && 
      c.description.includes('rows 3–4') && 
      c.description.includes('cols 4–5')
    );
    
    if (forcedBlock345) {
      console.log('\n=== Found forced block at rows 3-4, cols 4-5 ===');
      console.log(`Description: ${forcedBlock345.description}`);
      console.log(`Cells: ${forcedBlock345.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    } else {
      console.log('\n=== No forced block found at rows 3-4, cols 4-5 ===');
    }
    
    // Check all 2×2 blocks in rows 3-4 that intersect Region D
    console.log('\n=== All 2×2 blocks in rows 3-4 that intersect Region D ===');
    const regionD34Cells = regionD34?.cells ?? [];
    const regionD34Set = new Set(regionD34Cells.map(c => `${c.row},${c.col}`));
    
    for (let c = 0; c < state.def.size - 1; c += 1) {
      const block: Coords[] = [
        { row: 3, col: c },
        { row: 3, col: c + 1 },
        { row: 4, col: c },
        { row: 4, col: c + 1 },
      ];
      
      const blockInRegionD = block.filter(bc => 
        regionD34Set.has(`${bc.row},${bc.col}`)
      );
      
      if (blockInRegionD.length > 0) {
        const blockConstraint = constraints.find(cons => 
          cons.description.includes(`rows 3–4`) && 
          cons.description.includes(`cols ${c}–${c + 1}`)
        );
        const emptyInBlock = block.filter(bc => 
          state.cells[bc.row][bc.col] === 'empty'
        );
        const emptyInBlockAndRegionD = blockInRegionD.filter(bc => 
          state.cells[bc.row][bc.col] === 'empty'
        );
        
        console.log(`Block at cols ${c}-${c + 1}:`);
        console.log(`  All cells: ${block.map(bc => `(${bc.row},${bc.col})`).join(', ')}`);
        console.log(`  In Region D: ${blockInRegionD.map(bc => `(${bc.row},${bc.col})`).join(', ')}`);
        console.log(`  Empty in block: ${emptyInBlock.length}`);
        console.log(`  Empty in block AND Region D: ${emptyInBlockAndRegionD.length}`);
        if (blockConstraint) {
          console.log(`  Constraint: minStars=${blockConstraint.minStars}, maxStars=${blockConstraint.maxStars}`);
        }
      }
    }
    
    console.log('\n=== Analysis ===');
    console.log('Expected eliminations: (3,7), (4,6)');
    console.log('Block at rows 3-4, cols 4-5 contains: (3,4), (3,5), (4,5)');
    console.log('Region D rows 3-4 contains: (3,4), (3,5), (3,7), (4,5), (4,6)');
    console.log('If block had minStars=1 and region D 3-4 had maxStars=1, we could eliminate (3,7) and (4,6)');
    console.log('But block has minStars=0, so subset squeeze cannot use it');
  });
});

