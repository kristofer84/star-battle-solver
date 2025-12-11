import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findSchemaBasedHint } from '../src/logic/techniques/schemaBased';
// Ensure schemas are registered
import '../src/logic/schemas/index';
import type { PuzzleState } from '../src/types/puzzle';

/**
 * Parse puzzle from string format:
 * Format: "0x 0x 0x 1x 1s 1x 1x 2x 2s 2x"
 * Where: number = region (0-9, will be converted to 1-10), x = cross, s = star, number alone = empty
 */
function parsePuzzle(puzzleStr: string): PuzzleState {
  const lines = puzzleStr.trim().split('\n').map(line => line.trim());
  const regions: number[][] = [];
  
  for (let r = 0; r < 10; r++) {
    const line = lines[r];
    const cells = line.split(/\s+/);
    const regionRow: number[] = [];
    
    for (let c = 0; c < 10; c++) {
      const cell = cells[c];
      // Match: number, optionally followed by 'x' or 's'
      const match = cell.match(/^(\d+)([xs]?)$/);
      if (!match) {
        throw new Error(`Invalid cell format at row ${r}, col ${c}: ${cell}`);
      }
      
      const regionNum = parseInt(match[1], 10);
      // Convert region from 0-9 to 1-10
      regionRow.push(regionNum);
    }
    
    regions.push(regionRow);
  }
  
  const state = createEmptyPuzzleState({
    size: 10,
    starsPerUnit: 2,
    regions,
  });
  
  // Apply stars and crosses
  for (let r = 0; r < 10; r++) {
    const line = lines[r];
    const cells = line.split(/\s+/);
    
    for (let c = 0; c < 10; c++) {
      const cell = cells[c];
      const match = cell.match(/^(\d+)([xs]?)$/);
      if (!match) continue;
      
      const stateChar = match[2];
      if (stateChar === 's') {
        state.cells[r][c] = 'star';
      } else if (stateChar === 'x') {
        state.cells[r][c] = 'cross';
      }
      // else remains 'empty'
    }
  }
  
  return state;
}

/**
 * Parse expected solution to extract star positions
 */
function parseExpectedSolution(solutionStr: string): Array<[number, number]> {
  const lines = solutionStr.trim().split('\n').map(line => line.trim());
  const stars: Array<[number, number]> = [];
  
  for (let r = 0; r < 10; r++) {
    const line = lines[r];
    const cells = line.split(/\s+/);
    
    for (let c = 0; c < 10; c++) {
      const cell = cells[c];
      const match = cell.match(/^(\d+)([xs]?)$/);
      if (!match) continue;
      
      const stateChar = match[2];
      if (stateChar === 's') {
        stars.push([r, c]);
      }
    }
  }
  
  return stars;
}

describe('Debug faulty star from schema-based', () => {
  it('should identify where schema-based places incorrect star', () => {
    const inputPuzzle = `0 0 0 1 1 1x 2s 2x 3 3x
0 0 0 1 1 1x 2x 2x 3 3x
4 4 0 0 1 2 2 2x 2x 3
4 0 0 0 1x 2x 2x 3x 2x 3
4 0 5 0 1 7 7 3x 3 3x
4 0 5 1 1x 7x 3x 3x 9 3x
4 5 5 5 1x 7s 3x 8 9x 3x
4 4 5 5 5x 5x 5x 8 9x 9
4 4x 6 6 6 5x 5x 8 9x 9
6 6 6 5x 5 5x 5x 8 9x 9`;

    const expectedSolution = `0x 0x 0x 1s 1x 1x 2s 2x 3x 3x
0x 0s 0x 1x 1x 1x 2x 2x 3s 3x
4x 4x 0x 0s 1x 2s 2x 2x 2x 3x
4s 0x 0x 0x 1x 2x 2x 3x 2x 3s
4x 0x 5x 0x 1s 7x 7s 3x 3x 3x
4x 0x 5s 1x 1x 7x 3x 3x 9s 3x
4s 5x 5x 5x 1x 7s 3x 8x 9x 3x
4x 4x 5s 5x 5x 5x 5x 8s 9x 9x
4x 4x 6x 6x 6s 5x 5x 8x 9x 9s
6x 6s 6x 5x 5x 5x 5x 8s 9x 9x`;

    const state = parsePuzzle(inputPuzzle);
    const expectedStars = parseExpectedSolution(expectedSolution);
    
    console.log('\n=== Input Puzzle ===');
    for (let r = 0; r < 10; r++) {
      console.log(`Row ${r}:`, state.cells[r].map((c, i) => {
        const region = state.def.regions[r][i];
        if (c === 'star') return `${region-1}s`;
        if (c === 'cross') return `${region-1}x`;
        return `${region-1}`;
      }).join(' '));
    }
    
    console.log('\n=== Expected Stars ===');
    expectedStars.forEach(([r, c]) => {
      console.log(`Star at (${r}, ${c})`);
    });
    
    // Find what schema-based suggests
    const hint = findSchemaBasedHint(state);
    
    if (hint) {
      console.log('\n=== Schema-Based Hint ===');
      console.log('Technique:', hint.technique);
      console.log('ID:', hint.id);
      console.log('Kind:', hint.kind);
      console.log('Result cells:', hint.resultCells);
      
      if (hint.kind === 'place-star') {
        hint.resultCells.forEach(({ row, col }) => {
          const region = state.def.regions[row][col];
          console.log(`  Forces star at (${row}, ${col}), region ${region-1}`);
        });
      } else if (hint.kind === 'place-cross') {
        hint.resultCells.forEach(({ row, col }) => {
          const region = state.def.regions[row][col];
          console.log(`  Forces cross at (${row}, ${col}), region ${region-1}`);
        });
      }
      
      // Check if any forced stars conflict with expected solution
      if (hint.kind === 'place-star') {
        hint.resultCells.forEach(({ row, col }) => {
          const isExpected = expectedStars.some(([r, c]) => r === row && c === col);
          if (!isExpected) {
            console.log(`\n⚠️ FAULTY STAR: Schema-based forces star at (${row}, ${col}) but expected solution has no star there!`);
            const region = state.def.regions[row][col];
            console.log(`   Region: ${region-1}`);
            console.log(`   Current state: ${state.cells[row][col]}`);
          }
        });
      }
    } else {
      console.log('\n=== No Hint Found ===');
    }
    
    // Apply hint and see what happens
    if (hint) {
      const testState = JSON.parse(JSON.stringify(state)) as PuzzleState;
      hint.resultCells.forEach(({ row, col }) => {
        if (hint.kind === 'place-star') {
          testState.cells[row][col] = 'star';
        } else if (hint.kind === 'place-cross') {
          testState.cells[row][col] = 'cross';
        }
      });
      
      console.log('\n=== State After Applying Hint ===');
      for (let r = 0; r < 10; r++) {
        console.log(`Row ${r}:`, testState.cells[r].map((c, i) => {
          const region = testState.def.regions[r][i];
          if (c === 'star') return `${region-1}s`;
          if (c === 'cross') return `${region-1}x`;
          return `${region-1}`;
        }).join(' '));
      }
    }
  });
});

