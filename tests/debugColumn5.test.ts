import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
import { colCells, countStars, emptyCells } from '../src/logic/helpers';
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

function applyHint(state: PuzzleState): boolean {
  const hint = findNextHint(state);
  if (!hint) return false;
  
  for (const cell of hint.resultCells) {
    const newValue = hint.kind === 'place-star' ? 'star' : 'cross';
    state.cells[cell.row][cell.col] = newValue;
  }
  
  return true;
}

function getColumn5State(state: PuzzleState): string {
  const col = colCells(state, 4); // Column 5 is 0-indexed column 4
  const stars = countStars(state, col);
  const empties = emptyCells(state, col);
  const crosses = col.length - stars - empties.length;
  
  const cellStates = col.map(c => {
    const val = state.cells[c.row][c.col];
    return val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
  }).join('');
  
  return `Col 5: ${stars} stars, ${crosses} crosses, ${empties.length} empty | ${cellStates}`;
}

describe('Debug Column 5 Issue', () => {
  it('should track column 5 state after each hint', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const maxIterations = 200;
    let iteration = 0;
    const column5History: Array<{ iteration: number; technique: string; state: string }> = [];

    while (iteration < maxIterations) {
      const hint = findNextHint(state);
      if (!hint) break;

      const col5Before = getColumn5State(state);
      const technique = hint.technique;
      
      applyHint(state);
      
      const col5After = getColumn5State(state);
      const validationErrors = validateState(state);
      
      // Check if column 5 changed
      if (col5Before !== col5After) {
        column5History.push({
          iteration,
          technique,
          state: col5After,
        });
        
        console.log(`Iteration ${iteration}: ${technique}`);
        console.log(`  Before: ${col5Before}`);
        console.log(`  After:  ${col5After}`);
        
        // Check if column 5 has all crosses
        const col = colCells(state, 4);
        const stars = countStars(state, col);
        const empties = emptyCells(state, col);
        const crosses = col.length - stars - empties.length;
        
        if (crosses === 10) {
          console.error(`\n❌ COLUMN 5 HAS ALL CROSSES AT ITERATION ${iteration}!`);
          console.error(`Technique: ${technique}`);
          console.error(`Column 5 state: ${col5After}`);
          console.error(`Validation errors:`, validationErrors);
          
          // Print which cells were changed
          console.error(`Cells changed by this hint:`, hint.resultCells.map(c => `(${c.row},${c.col})`));
          
          // Check if this hint affected column 5
          const affectedCol5 = hint.resultCells.some(c => c.col === 4);
          if (affectedCol5) {
            console.error(`This hint directly affected column 5!`);
            const col5Changes = hint.resultCells.filter(c => c.col === 4);
            console.error(`Column 5 cells changed:`, col5Changes.map(c => `(${c.row},${c.col}) -> ${hint.kind === 'place-star' ? 'star' : 'cross'}`));
          }
          
          expect(crosses).not.toBe(10);
        }
        
        if (validationErrors.length > 0) {
          console.error(`Validation errors:`, validationErrors);
          expect(validationErrors).toEqual([]);
        }
      }

      iteration++;
    }

    console.log(`\n=== Column 5 History ===`);
    column5History.forEach(entry => {
      console.log(`Iteration ${entry.iteration} (${entry.technique}): ${entry.state}`);
    });
    
    // Final check
    const finalCol5 = getColumn5State(state);
    console.log(`\nFinal column 5 state: ${finalCol5}`);
    
    // Column 5 should have 2 stars at rows 2 and 6 (0-indexed)
    const col = colCells(state, 4);
    const finalStars = col.filter(c => state.cells[c.row][c.col] === 'star');
    const expectedStars = [[2, 4], [6, 4]];
    const actualStars = finalStars.map(c => [c.row, c.col] as [number, number]);
    
    console.log(`Expected stars in col 5:`, expectedStars);
    console.log(`Actual stars in col 5:`, actualStars);
    
    expect(finalStars.length).toBe(2);
  });
});
