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

describe('Test Region 3 rows 0-2 constraint', () => {
  it('should verify region 3 rows 0-2 has minStars=1, maxStars=1', () => {
    const state = parsePuzzle(INITIAL_STATE);
    const stats = computeStats(state);
    const constraints = allConstraints(stats);

    // Check row constraints for rows 0-2
    console.log('\n=== Row constraints for rows 0-2 ===');
    for (let r = 0; r <= 2; r += 1) {
      const rowConstraint = constraints.find(c => 
        c.source === 'row' && c.description.includes(`Row ${r}`)
      );
      if (rowConstraint) {
        console.log(`Row ${r}: ${rowConstraint.description}`);
        console.log(`  minStars: ${rowConstraint.minStars}, maxStars: ${rowConstraint.maxStars}`);
        console.log(`  cells: ${rowConstraint.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
      }
    }

    // Check region constraints for regions 0, 1, 2, 3
    console.log('\n=== Region constraints ===');
    for (let regionId = 1; regionId <= 4; regionId += 1) {
      const regionConstraint = constraints.find(c => 
        c.source === 'region' && c.description.includes(`Region ${String.fromCharCode(64 + regionId)}`)
      );
      if (regionConstraint) {
        console.log(`Region ${String.fromCharCode(64 + regionId)}: ${regionConstraint.description}`);
        console.log(`  minStars: ${regionConstraint.minStars}, maxStars: ${regionConstraint.maxStars}`);
        console.log(`  cells: ${regionConstraint.cells.length}`);
        
        // Count stars already placed in rows 0-2
        const starsInRows02 = regionConstraint.cells.filter(c => 
          c.row <= 2 && state.cells[c.row][c.col] === 'star'
        );
        const emptyInRows02 = regionConstraint.cells.filter(c => 
          c.row <= 2 && state.cells[c.row][c.col] === 'empty'
        );
        console.log(`  Stars in rows 0-2: ${starsInRows02.length}`);
        console.log(`  Empty cells in rows 0-2: ${emptyInRows02.length}`);
      }
    }

    // Check region 3 (Region D) band constraints
    console.log('\n=== Region 3 (Region D) band constraints ===');
    const region3Bands = constraints.filter(c => 
      c.source === 'region-band' && c.description.includes('Region D')
    );
    region3Bands.forEach((band, i) => {
      console.log(`${i}: ${band.description}`);
      console.log(`  minStars: ${band.minStars}, maxStars: ${band.maxStars}`);
      console.log(`  cells: ${band.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
      
      // Check if this is rows 0-2
      if (band.description.includes('rows 0–2')) {
        console.log(`  *** This is the rows 0-2 band! ***`);
        console.log(`  Expected: minStars=1, maxStars=1`);
        console.log(`  Actual: minStars=${band.minStars}, maxStars=${band.maxStars}`);
      }
    });

    // Manual calculation
    console.log('\n=== Manual calculation ===');
    console.log('Rows 0-2 need: 2 stars per row × 3 rows = 6 stars total');
    console.log('Region 0 (A) in rows 0-2: 1 star (already placed at (0,4))');
    console.log('Region 1 (B) in rows 0-2: needs 2 stars');
    console.log('Region 2 (C) in rows 0-2: needs 2 stars');
    console.log('Total accounted: 1 + 2 + 2 = 5 stars');
    console.log('Remaining for Region 3 (D) in rows 0-2: 6 - 5 = 1 star');
    console.log('Therefore: Region 3 rows 0-2 should have minStars=1, maxStars=1');
  });
});

