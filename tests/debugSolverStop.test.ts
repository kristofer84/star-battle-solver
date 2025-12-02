import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint, techniquesInOrder } from '../src/logic/techniques';
import type { PuzzleState } from '../src/types/puzzle';

// Example board from example.md
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

function applyHint(state: PuzzleState) {
  const hint = findNextHint(state);
  if (!hint) return false;
  
  for (const cell of hint.resultCells) {
    const value = hint.kind === 'place-star' ? 'star' : 'cross';
    state.cells[cell.row][cell.col] = value;
  }
  
  return true;
}

describe('Debug Solver Stop Issue', () => {
  it('should identify why solver stops finding hints', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const maxIterations = 50;
    let iteration = 0;
    const hints = [];
    const techniqueResults: Record<string, number> = {};

    // Apply hints until no more are found
    while (iteration < maxIterations) {
      // Check what each technique finds
      const techniqueChecks: Record<string, boolean> = {};
      for (const tech of techniquesInOrder) {
        const hint = tech.findHint(state);
        techniqueChecks[tech.id] = hint !== null;
        if (hint) {
          techniqueResults[tech.id] = (techniqueResults[tech.id] || 0) + 1;
        }
      }

      const hint = findNextHint(state);
      if (!hint) {
        console.log(`\n=== Stopped at iteration ${iteration} ===`);
        console.log('Technique results:', techniqueChecks);
        console.log('Total hints by technique:', techniqueResults);
        
        // Count current state
        let starCount = 0;
        let crossCount = 0;
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            if (state.cells[r][c] === 'star') starCount++;
            if (state.cells[r][c] === 'cross') crossCount++;
          }
        }
        console.log(`Stars: ${starCount}, Crosses: ${crossCount}`);
        
        // Show a sample of the board
        console.log('\nSample board state (first 3 rows):');
        for (let r = 0; r < 3; r++) {
          const row = [];
          for (let c = 0; c < 10; c++) {
            if (state.cells[r][c] === 'star') row.push('★');
            else if (state.cells[r][c] === 'cross') row.push('×');
            else row.push('.');
          }
          console.log(row.join(' '));
        }
        
        break;
      }

      hints.push({
        iteration,
        technique: hint.technique,
        kind: hint.kind,
        cells: hint.resultCells.map(c => [c.row, c.col]),
      });

      applyHint(state);
      iteration++;
    }

    console.log(`\nTotal hints applied: ${iteration}`);
    console.log('Techniques used:', [...new Set(hints.map(h => h.technique))]);
    
    // The test should reveal why it stopped
    expect(iteration).toBeGreaterThan(0);
  });
});
