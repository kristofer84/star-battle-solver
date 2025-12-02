import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
import { colCells, countStars, emptyCells } from '../src/logic/helpers';
import * as fs from 'fs';
import * as path from 'path';
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

const EXPECTED_STARS: [number, number][] = [
  [0, 3], [0, 6],
  [1, 1], [1, 8],
  [2, 3], [2, 5],
  [3, 0], [3, 9],
  [4, 4], [4, 6],
  [5, 2], [5, 8],
  [6, 0], [6, 5],
  [7, 2], [7, 7],
  [8, 4], [8, 9],
  [9, 1], [9, 7],
];

function applyHint(state: PuzzleState): { applied: boolean; cellsChanged: [number, number, string][]; hint: any } {
  const hint = findNextHint(state);
  if (!hint) {
    return { applied: false, cellsChanged: [], hint: null };
  }
  
  const cellsChanged: [number, number, string][] = [];
  for (const cell of hint.resultCells) {
    const oldValue = state.cells[cell.row][cell.col];
    const newValue = hint.kind === 'place-star' ? 'star' : 'cross';
    if (oldValue !== newValue) {
      state.cells[cell.row][cell.col] = newValue;
      cellsChanged.push([cell.row, cell.col, newValue]);
    }
  }
  
  return { applied: true, cellsChanged, hint };
}

function getColumn5State(state: PuzzleState): string {
  const col = colCells(state, 4);
  const stars = countStars(state, col);
  const empties = emptyCells(state, col);
  const crosses = col.length - stars - empties.length;
  
  const cellStates = col.map(c => {
    const val = state.cells[c.row][c.col];
    return val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
  }).join('');
  
  return `${stars} stars, ${crosses} crosses, ${empties.length} empty | ${cellStates}`;
}

describe('Detailed Column 5 Trace', () => {
  it('should trace column 5 after each hint', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const output: string[] = [];
    output.push('=== Column 5 Detailed Trace ===\n');
    output.push(`Expected stars in column 5: rows 2 and 6 (0-indexed)\n`);
    output.push(`Initial column 5: ${getColumn5State(state)}\n`);

    let iteration = 0;
    const maxIterations = 300;

    while (iteration < maxIterations) {
      const { applied, cellsChanged, hint } = applyHint(state);
      
      if (!applied || !hint) {
        output.push(`\nNo more hints at iteration ${iteration}`);
        break;
      }

      if (cellsChanged.length === 0) {
        output.push(`\nIteration ${iteration}: ${hint.technique} (${hint.kind}) - no cells changed`);
        iteration++;
        continue;
      }

      const col5Before = getColumn5State(state);
      const col5Changed = cellsChanged.filter(([r, c]) => c === 4);
      
      // Apply the hint (already applied above, but we need to check state)
      const col5After = getColumn5State(state);
      const errors = validateState(state);
      
      // Always log if column 5 changed or if this hint affects column 5
      if (col5Changed.length > 0 || col5Before !== col5After) {
        output.push(`\nIteration ${iteration}: ${hint.technique} (${hint.kind})`);
        output.push(`  Column 5 before: ${col5Before}`);
        output.push(`  Column 5 after:  ${col5After}`);
        if (col5Changed.length > 0) {
          output.push(`  Changed in col 5: ${col5Changed.map(([r, c, v]) => `(${r},${c})=${v}`).join(', ')}`);
        }
        
        // Check for all crosses
        const col = colCells(state, 4);
        const stars = countStars(state, col);
        const empties = emptyCells(state, col);
        const crosses = col.length - stars - empties.length;
        
        if (crosses === 10) {
          output.push(`\n❌❌❌ COLUMN 5 HAS ALL CROSSES! ❌❌❌`);
          output.push(`  Technique: ${hint.technique} (${hint.kind})`);
          output.push(`  Cells changed: ${cellsChanged.map(([r, c, v]) => `(${r},${c})=${v}`).join(', ')}`);
          output.push(`  Validation errors: ${errors.join('; ')}`);
          
          // Print full column 5 state
          output.push(`\n  Column 5 detailed state:`);
          for (let r = 0; r < 10; r++) {
            const val = state.cells[r][4];
            const marker = val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
            const expected = [2, 6].includes(r) ? ' (should be S)' : '';
            output.push(`    Row ${r}: ${marker}${expected}`);
          }
        }
        
        if (errors.length > 0) {
          output.push(`  ⚠️  Validation errors: ${errors.join('; ')}`);
        }
      }

      iteration++;
    }

    // Final state
    const finalCol5 = getColumn5State(state);
    output.push(`\n=== Final Column 5 State ===`);
    output.push(finalCol5);
    
    const col = colCells(state, 4);
    const finalStars = col
      .map((c, idx) => ({ row: c.row, val: state.cells[c.row][c.col] }))
      .filter(c => c.val === 'star')
      .map(c => c.row);
    
    output.push(`Final stars at rows: ${finalStars.join(', ')}`);
    output.push(`Expected stars at rows: 2, 6`);
    
    // Write to file
    const outputPath = path.join(__dirname, 'column5_trace.txt');
    fs.writeFileSync(outputPath, output.join('\n'), 'utf-8');
    console.log(`\nTrace written to: ${outputPath}`);
    
    // Also output to console for vitest
    console.log(output.join('\n'));
    
    // Assertions
    const finalStarsCount = countStars(state, col);
    expect(finalStarsCount).toBe(2);
    expect(finalStars.sort()).toEqual([2, 6]);
  });
});
