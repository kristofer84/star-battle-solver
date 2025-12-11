import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findEntanglementPatternHint } from '../src/logic/techniques/entanglementPatterns';
import { getCell } from '../src/logic/helpers';

/**
 * Parse puzzle from user's format:
 * Format: "0x 0x 0x 0x 0s 1x 1 1 1 1x"
 * Where: number = region (0-9, will be converted to 1-10), x = cross, s = star, space = empty
 */
function parsePuzzle(puzzleStr: string): { state: PuzzleState; regions: number[][] } {
  const lines = puzzleStr.trim().split('\n').map(line => line.trim());
  const regions: number[][] = [];
  const stars: [number, number][] = [];
  const crosses: [number, number][] = [];
  
  for (let r = 0; r < 10; r++) {
    const line = lines[r];
    const cells = line.split(/\s+/);
    const regionRow: number[] = [];
    
    for (let c = 0; c < 10; c++) {
      const cell = cells[c];
      // Parse format: region + state (x, s, or empty)
      const match = cell.match(/^(\d+)([xs]?)$/);
      if (!match) {
        throw new Error(`Invalid cell format at row ${r}, col ${c}: ${cell}`);
      }
      
      const regionNum = parseInt(match[1], 10);
      const state = match[2];
      
      // Convert region from 0-9 to 1-10
      regionRow.push(regionNum);
      
      if (state === 's') {
        stars.push([r, c]);
      } else if (state === 'x') {
        crosses.push([r, c]);
      }
      // else empty, which is the default
    }
    
    regions.push(regionRow);
  }
  
  const state = createEmptyPuzzleState({
    size: 10,
    starsPerUnit: 2,
    regions,
  });
  
  for (const [r, c] of stars) {
    state.cells[r][c] = 'star';
  }
  for (const [r, c] of crosses) {
    state.cells[r][c] = 'cross';
  }
  
  return { state, regions };
}

describe('Debug Pattern Matching - User Puzzle', () => {
  it('should check pattern matching on user puzzle state', () => {
    const puzzleStr = `0x 0x 0x 0x 0s 1x 1 1 1 1x
2 2x 2s 0x 1x 1x 1 1x 1 3x
2 2x 0x 0x 1 3 3 3 3 3x
4x 4x 0s 4x 3 3 3x 3 3x 8
4x 4x 0x 4x 3x 3 3 7 7x 8
5x 4s 4x 4s 6x 6x 7x 7x 8x 8x
5x 6x 4x 6x 6x 6 6 7 7x 8
5s 6x 6x 6 7 7 7x 7x 8x 8
5x 5x 5x 6 6x 7x 9 9 9 9x
5x 5s 6x 6 9 9 9 9x 9 9x`;

    const { state } = parsePuzzle(puzzleStr);
    
    console.log('\n=== User Puzzle State ===');
    console.log('Stars:');
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (getCell(state, { row: r, col: c }) === 'star') {
          console.log(`  (${r}, ${c})`);
        }
      }
    }
    
    console.log('\n=== Testing Pattern Matching ===');
    const hint = findEntanglementPatternHint(state);
    
    if (hint) {
      console.log(`\nFound hint: ${hint.technique}`);
      console.log(`Pattern ID: ${hint.patternId}`);
      console.log(`Kind: ${hint.kind}`);
      console.log(`Result cells: ${hint.resultCells.map(c => `(${c.row},${c.col})`).join(', ')}`);
      console.log(`Explanation: ${hint.explanation}`);
      
      // Check if any result cell is at (1, 0) which is row 1, col 0
      // Row 1 is on ring 1, but col 0 is on the actual edge (not ring 1)
      for (const cell of hint.resultCells) {
        console.log(`\nCandidate (${cell.row},${cell.col}):`);
        console.log(`  Row ${cell.row}: ${cell.row === 1 || cell.row === 8 ? 'ON ring 1' : cell.row === 0 || cell.row === 9 ? 'ON actual edge' : 'interior'}`);
        console.log(`  Col ${cell.col}: ${cell.col === 1 || cell.col === 8 ? 'ON ring 1' : cell.col === 0 || cell.col === 9 ? 'ON actual edge' : 'interior'}`);
        
        // For candidate_on_outer_ring, the candidate must be on ring 1
        // Ring 1 means: row 1 OR row 8 OR col 1 OR col 8
        const isOnRing1 = 
          cell.row === 1 || 
          cell.row === 8 || 
          cell.col === 1 || 
          cell.col === 8;
        
        if (hint.patternId === '39220f') {
          // This is the constrained rule with candidate_on_outer_ring
          console.log(`  Is on ring 1: ${isOnRing1}`);
          if (!isOnRing1) {
            console.log(`  ERROR: Pattern [39220f] matched but candidate is NOT on ring 1!`);
          }
        }
      }
    } else {
      console.log('\nNo hint found');
    }
  });
});

