import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findEntanglementHint } from '../src/logic/techniques/entanglement';
import { getRuleViolations } from '../src/logic/validation';
import { getCell } from '../src/logic/helpers';

/**
 * Helper to set cell states in a puzzle
 */
function setCells(state: PuzzleState, stars: [number, number][], crosses: [number, number][]) {
  for (const [r, c] of stars) {
    state.cells[r][c] = 'star';
  }
  for (const [r, c] of crosses) {
    state.cells[r][c] = 'cross';
  }
}

/**
 * Parse puzzle from user's format:
 * Format: "0x 0x 0x 1x 1s 1x 1x 2x 2s 2x"
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
  
  setCells(state, stars, crosses);
  
  return { state, regions };
}

describe('Debug Entanglement Invalid Placement', () => {
  it('should not place invalid crosses on row 6 and column 7', () => {
    const puzzleStr = `0x 0x 0x 1x 1s 1x 1x 2x 2s 2x
0x 3s 3x 3x 1x 1x 1s 1x 1x 2x
0x 0x 3x 3s 4x 1x 4x 1x 1x 2s
0s 4x 4x 4x 4x 4s 4x 4 2x 2x
0 0 5 5 4x 4x 4x 4 4x 2x
0 0 0x 5x 5x 6s 6x 6 7x 7
0x 0x 5x 5x 5x 5x 6x 6 7x 7
8 5 5 5x 5x 5x 5x 5x 7x 7x
8x 5x 5x 8x 5x 9x 9s 5x 7s 7x
8 8x 8 8x 9s 9x 9x 9x 9x 7x`;

    const { state, regions } = parsePuzzle(puzzleStr);
    
    console.log('\n=== Puzzle State ===');
    console.log('Regions:');
    regions.forEach((row, i) => console.log(`Row ${i}: ${row.join(' ')}`));
    
    console.log('\nCells:');
    for (let r = 0; r < 10; r++) {
      const row = [];
      for (let c = 0; c < 10; c++) {
        const cell = getCell(state, { row: r, col: c });
        if (cell === 'star') row.push('s');
        else if (cell === 'cross') row.push('x');
        else row.push('.');
      }
      console.log(`Row ${r}: ${row.join(' ')}`);
    }
    
    // Check initial state for violations
    const initialViolations = getRuleViolations(state);
    console.log('\n=== Initial Violations ===');
    console.log('Rows with violations:', Array.from(initialViolations.rows));
    console.log('Cols with violations:', Array.from(initialViolations.cols));
    console.log('Regions with violations:', Array.from(initialViolations.regions));
    console.log('Adjacent cells:', Array.from(initialViolations.adjacentCells));
    
    expect(initialViolations.rows.size).toBe(0);
    expect(initialViolations.cols.size).toBe(0);
    expect(initialViolations.regions.size).toBe(0);
    expect(initialViolations.adjacentCells.size).toBe(0);
    
    // Test entanglement technique
    console.log('\n=== Testing Entanglement Technique ===');
    const hint = findEntanglementHint(state);
    
    if (hint) {
      console.log(`\nFound hint: ${hint.technique}`);
      console.log(`Kind: ${hint.kind}`);
      console.log(`Result cells: ${hint.resultCells.map(c => `(${c.row},${c.col})`).join(', ')}`);
      console.log(`Explanation: ${hint.explanation}`);
      
      // Apply the hint to a copy of the state
      const testState: PuzzleState = {
        def: state.def,
        cells: state.cells.map(row => [...row]),
      };
      
      for (const cell of hint.resultCells) {
        const currentState = getCell(testState, cell);
        // For schema-based hints with mixed types, use schemaCellTypes
        let targetKind: 'place-star' | 'place-cross';
        if (hint.schemaCellTypes) {
          const cellType = hint.schemaCellTypes.get(`${cell.row},${cell.col}`);
          targetKind = cellType === 'star' ? 'place-star' : 'place-cross';
        } else {
          targetKind = hint.kind;
        }
        console.log(`\nApplying ${targetKind} at (${cell.row},${cell.col}), current state: ${currentState}`);
        
        if (targetKind === 'place-star') {
          if (currentState === 'star') {
            console.log(`  ERROR: Trying to place star on cell that's already a star!`);
          } else if (currentState === 'cross') {
            console.log(`  ERROR: Trying to place star on cell that's already a cross!`);
          } else {
            testState.cells[cell.row][cell.col] = 'star';
          }
        } else if (targetKind === 'place-cross') {
          if (currentState === 'star') {
            console.log(`  ERROR: Trying to place cross on cell that's already a star!`);
          } else {
            testState.cells[cell.row][cell.col] = 'cross';
          }
        }
      }
      
      // Check for violations after applying hint
      const violations = getRuleViolations(testState);
      console.log('\n=== Violations After Applying Hint ===');
      console.log('Rows with violations:', Array.from(violations.rows));
      console.log('Cols with violations:', Array.from(violations.cols));
      console.log('Regions with violations:', Array.from(violations.regions));
      console.log('Adjacent cells:', Array.from(violations.adjacentCells));
      
      // Verify no invalid placements
      for (const cell of hint.resultCells) {
        const currentState = getCell(state, cell);
        if (hint.kind === 'place-star') {
          expect(currentState).not.toBe('star');
          expect(currentState).not.toBe('cross');
        } else if (hint.kind === 'place-cross') {
          expect(currentState).not.toBe('star');
        }
      }
      
      // Verify no violations after applying
      expect(violations.rows.size).toBe(0);
      expect(violations.cols.size).toBe(0);
      expect(violations.regions.size).toBe(0);
      expect(violations.adjacentCells.size).toBe(0);
    } else {
      console.log('\nNo hint found');
    }
  });
});

