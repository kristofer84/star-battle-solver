import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { getCell } from '../src/logic/helpers';
import { validateState } from '../src/logic/validation';
import { analyzeDeductions } from '../src/logic/mainSolver';
import type { Deduction } from '../src/types/deductions';

/**
 * Parse puzzle from user's format
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
      const match = cell.match(/^(\d+)([xs]?)$/);
      if (!match) {
        throw new Error(`Invalid cell format at row ${r}, col ${c}: ${cell}`);
      }
      
      const regionNum = parseInt(match[1], 10);
      const state = match[2];
      
      regionRow.push(regionNum);
      
      if (state === 's') {
        stars.push([r, c]);
      } else if (state === 'x') {
        crosses.push([r, c]);
      }
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

function printState(state: PuzzleState): void {
  console.log('\n=== Puzzle State ===');
  for (let r = 0; r < 10; r++) {
    let row = '';
    for (let c = 0; c < 10; c++) {
      const cell = getCell(state, { row: r, col: c });
      if (cell === 'star') row += '★';
      else if (cell === 'cross') row += '✗';
      else row += '·';
      row += ' ';
    }
    console.log(row);
  }
}

describe('User Puzzle - Faulty Hint', () => {
  it('should identify the faulty hint from main solver', async () => {
    const puzzleStr = `0 0 0 0 0 1 1 1 1 1
0 2 0 0 0 0 0 1 3 1
0 2 2 0 0 4 4 3 3 1
0 2 2 2 4 4 3 3 1 1
0 0 2 2 4 4 3 3 8 1
5 0 0 4 4 4 3 8 8 8
5 6 0 4 7 7 3 3 3 8
5x 6 6x 7 7x 7 3x 9 8 8
5 6 6 6 6x 7 7x 9 8x 8
5 5 5x 5 5 9 9 9 8 8`;

    const { state } = parsePuzzle(puzzleStr);
    
    printState(state);
    
    // Validate the puzzle state
    const validationErrors = validateState(state);
    console.log('\n=== Validation ===');
    if (validationErrors.length > 0) {
      console.log('Errors:', validationErrors);
    } else {
      console.log('No validation errors');
    }
    
    // Try to find hints - but intercept to see what deductions are being used
    console.log('\n=== Finding Hint ===');
    
    // We need to manually simulate what findNextHint does to capture deductions
    // Let's use a spy or manual approach
    const hint = await findNextHint(state);
    
    if (hint) {
      console.log(`\n=== HINT FOUND ===`);
      console.log(`Technique: ${hint.technique}`);
      console.log(`Kind: ${hint.kind}`);
      console.log(`Explanation: ${hint.explanation}`);
      console.log(`Result cells: ${hint.resultCells.map(c => `(${c.row},${c.col})`).join(', ')}`);
      
      // Check if applying the hint would create a validation error
      const testState: PuzzleState = {
        ...state,
        cells: state.cells.map(row => [...row]),
      };
      
      let hasInvalidPlacement = false;
      for (const cell of hint.resultCells) {
        const currentValue = testState.cells[cell.row][cell.col];
        const targetValue = hint.kind === 'place-star' ? 'star' : 'cross';
        
        console.log(`\nCell (${cell.row},${cell.col}):`);
        console.log(`  Current: ${currentValue}`);
        console.log(`  Target: ${targetValue}`);
        console.log(`  Region: ${state.def.regions[cell.row][cell.col]}`);
        
        if (currentValue !== 'empty' && currentValue !== targetValue) {
          console.log(`  ❌ ERROR: Cell is already ${currentValue}, cannot place ${targetValue}!`);
          hasInvalidPlacement = true;
        } else if (currentValue === 'empty') {
          testState.cells[cell.row][cell.col] = targetValue;
        }
      }
      
      const errorsAfterHint = validateState(testState);
      if (errorsAfterHint.length > 0 || hasInvalidPlacement) {
        console.log(`\n=== ❌ FAULTY HINT DETECTED ===`);
        if (hasInvalidPlacement) {
          console.log(`Hint tries to place on non-empty cells!`);
        }
        if (errorsAfterHint.length > 0) {
          console.log(`Applying this hint creates validation errors:`);
          errorsAfterHint.forEach(err => console.log(`  - ${err}`));
        }
        
        // Fail the test to highlight the faulty hint
        expect(errorsAfterHint.length).toBe(0);
        expect(hasInvalidPlacement).toBe(false);
      } else {
        console.log(`\n✓ Hint appears valid (no validation errors after applying)`);
      }
    } else {
      console.log('No hints found');
    }
  });
});

