import { describe, it } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findSubsetConstraintSqueeze, computeStats, allConstraints } from '../src/logic/stats';
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

describe('Debug Subset Squeeze - Simple', () => {
  it('should identify the constraint pair for region 4 eliminations', () => {
    const state = parsePuzzle(INITIAL_STATE);
    const stats = computeStats(state);
    const constraints = allConstraints(stats);

    // Expected eliminations: (3,7) and (4,6) in region 4
    const expectedElims = [
      { row: 3, col: 7 },
      { row: 4, col: 6 },
    ];

    console.log('\n=== Looking for constraints containing expected eliminations ===');
    
    // Find constraints that contain the expected elimination cells
    const relevantConstraints = constraints.filter(c => {
      const elimSet = new Set(expectedElims.map(e => `${e.row},${e.col}`));
      return c.cells.some(cell => elimSet.has(`${cell.row},${cell.col}`));
    });

    console.log(`Found ${relevantConstraints.length} constraints containing expected eliminations:`);
    relevantConstraints.forEach((c, i) => {
      console.log(`\n${i}: ${c.source} - ${c.description}`);
      console.log(`  minStars: ${c.minStars}, maxStars: ${c.maxStars}`);
      console.log(`  cells (${c.cells.length}): ${c.cells.map(cell => {
        const isExpected = expectedElims.some(e => e.row === cell.row && e.col === cell.col);
        return `(${cell.row},${cell.col})${isExpected ? '*' : ''}`;
      }).join(', ')}`);
    });

    // Now look for subset relationships among these constraints
    console.log('\n=== Looking for subset relationships ===');
    for (let i = 0; i < relevantConstraints.length; i += 1) {
      for (let j = 0; j < relevantConstraints.length; j += 1) {
        if (i === j) continue;
        const small = relevantConstraints[i];
        const large = relevantConstraints[j];
        
        const largeSet = new Set(large.cells.map(c => `${c.row},${c.col}`));
        const isSubset = small.cells.every(c => largeSet.has(`${c.row},${c.col}`));
        
        if (isSubset && small.minStars > 0 && small.minStars === large.maxStars) {
          const diff = large.cells.filter(lc => 
            !small.cells.some(sc => sc.row === lc.row && sc.col === lc.col)
          );
          const emptyDiff = diff.filter(c => state.cells[c.row][c.col] === 'empty');
          const expectedInDiff = emptyDiff.filter(c => 
            expectedElims.some(e => e.row === c.row && e.col === c.col)
          );
          
          console.log(`\n*** VALID SUBSET PAIR FOUND ***`);
          console.log(`Small: ${small.source} - ${small.description}`);
          console.log(`  minStars: ${small.minStars}, maxStars: ${small.maxStars}`);
          console.log(`Large: ${large.source} - ${large.description}`);
          console.log(`  minStars: ${large.minStars}, maxStars: ${large.maxStars}`);
          console.log(`Difference cells: ${diff.length}, empty: ${emptyDiff.length}`);
          console.log(`Expected eliminations in diff: ${expectedInDiff.length}`);
          if (expectedInDiff.length > 0) {
            console.log(`  Cells: ${expectedInDiff.map(c => `(${c.row},${c.col})`).join(', ')}`);
          }
        }
      }
    }

    // Also check all constraints for region 4
    console.log('\n=== Region 4 (Region D) constraints ===');
    const region4Constraints = constraints.filter(c => 
      c.description.includes('Region D') || 
      c.cells.some(cell => state.def.regions[cell.row][cell.col] === 4)
    );
    region4Constraints.forEach((c, i) => {
      const region4Cells = c.cells.filter(cell => state.def.regions[cell.row][cell.col] === 4);
      if (region4Cells.length > 0) {
        console.log(`${i}: ${c.source} - ${c.description}`);
        console.log(`  minStars: ${c.minStars}, maxStars: ${c.maxStars}`);
        console.log(`  Region 4 cells: ${region4Cells.length}`);
      }
    });
  });
});

