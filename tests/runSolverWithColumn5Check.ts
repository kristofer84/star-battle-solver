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

function getColumn5State(state: PuzzleState): {
  stars: number;
  crosses: number;
  empties: number;
  cellStates: string;
  starRows: number[];
} {
  const col = colCells(state, 4);
  const stars = countStars(state, col);
  const empties = emptyCells(state, col);
  const crosses = col.length - stars - empties.length;
  
  const cellStates = col.map(c => {
    const val = state.cells[c.row][c.col];
    return val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
  }).join('');
  
  const starRows = col
    .map((c, idx) => ({ row: c.row, val: state.cells[c.row][c.col] }))
    .filter(c => c.val === 'star')
    .map(c => c.row);
  
  return { stars, crosses, empties, cellStates, starRows };
}

function checkAgainstExpected(state: PuzzleState): {
  matches: boolean;
  missing: [number, number][];
  extra: [number, number][];
} {
  const actualStars: [number, number][] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (state.cells[r][c] === 'star') {
        actualStars.push([r, c]);
      }
    }
  }
  
  const expectedSet = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));
  const actualSet = new Set(actualStars.map(([r, c]) => `${r},${c}`));
  
  const missing = EXPECTED_STARS.filter(([r, c]) => !actualSet.has(`${r},${c}`));
  const extra = actualStars.filter(([r, c]) => !expectedSet.has(`${r},${c}`));
  
  return { matches: missing.length === 0 && extra.length === 0, missing, extra };
}

const output: string[] = [];
output.push('=== Running Solver with Column 5 Verification ===');
output.push('Expected stars in column 5: rows 2 and 6 (0-indexed)');
output.push('');

const state = createEmptyPuzzleState({
  size: 10,
  starsPerUnit: 2,
  regions: EXAMPLE_REGIONS,
});

let iteration = 0;
const maxIterations = 300;

while (iteration < maxIterations) {
  const hint = findNextHint(state);
  if (!hint) {
    output.push(`\nNo more hints at iteration ${iteration}`);
    break;
  }

  const col5Before = getColumn5State(state);
  const technique = hint.technique;
  const kind = hint.kind;
  
  // Apply hint directly to state
  for (const cell of hint.resultCells) {
    const newValue = hint.kind === 'place-star' ? 'star' : 'cross';
    state.cells[cell.row][cell.col] = newValue;
  }
  
  const col5After = getColumn5State(state);
  const errors = validateState(state);
  const comparison = checkAgainstExpected(state);
  
  // Check if column 5 changed
  const col5Changed = col5Before.cellStates !== col5After.cellStates;
  const col5CellsChanged = hint.resultCells.some(c => c.col === 4);
  
  if (col5Changed || col5CellsChanged) {
    output.push(`\nIteration ${iteration}: ${technique} (${kind})`);
    output.push(`  Column 5 before: ${col5Before.stars} stars, ${col5Before.crosses} crosses, ${col5Before.empties} empty | ${col5Before.cellStates}`);
    output.push(`  Column 5 after:  ${col5After.stars} stars, ${col5After.crosses} crosses, ${col5After.empties} empty | ${col5After.cellStates}`);
    
    const changedInCol5 = hint.resultCells.filter(c => c.col === 4);
    if (changedInCol5.length > 0) {
      output.push(`  Changed in col 5: ${changedInCol5.map(c => `(${c.row},${c.col})=${kind === 'place-star' ? 'star' : 'cross'}`).join(', ')}`);
    }
    
    // Check for all crosses
    if (col5After.crosses === 10) {
      output.push(`\n❌❌❌ COLUMN 5 HAS ALL CROSSES! ❌❌❌`);
      output.push(`  Technique: ${technique} (${kind})`);
      output.push(`  Validation errors: ${errors.join('; ')}`);
      output.push(`  Column 5 state: ${col5After.cellStates}`);
      output.push(`  Expected stars at rows: 2, 6`);
      output.push(`  Actual stars at rows: ${col5After.starRows.join(', ') || 'none'}`);
      const outputPath = path.join(__dirname, 'column5_trace.txt');
      fs.writeFileSync(outputPath, output.join('\n'), 'utf-8');
      console.error(output.join('\n'));
      process.exit(1);
    }
    
    // Verify against expected
    if (col5After.stars > 0) {
      const expectedStarsInCol5 = [2, 6];
      const wrongStars = col5After.starRows.filter(r => !expectedStarsInCol5.includes(r));
      if (wrongStars.length > 0) {
        output.push(`  ⚠️  Column 5 has stars at wrong rows: ${wrongStars} (expected [2, 6])`);
      }
    }
  }
  
  if (errors.length > 0) {
    output.push(`\n⚠️  Validation errors at iteration ${iteration}: ${errors.join('; ')}`);
  }
  
  // Check overall progress
  if (iteration % 20 === 0) {
    const totalStars = state.cells.flat().filter(c => c === 'star').length;
    output.push(`\nProgress: ${totalStars}/20 stars placed`);
  }

  iteration++;
}

// Final verification
const finalCol5 = getColumn5State(state);
const finalComparison = checkAgainstExpected(state);
const finalErrors = validateState(state);

output.push(`\n=== Final Results ===`);
output.push(`Total iterations: ${iteration}`);
output.push(`Column 5: ${finalCol5.stars} stars, ${finalCol5.crosses} crosses, ${finalCol5.empties} empty`);
output.push(`Column 5 state: ${finalCol5.cellStates}`);
output.push(`Column 5 stars at rows: ${finalCol5.starRows.join(', ')}`);
output.push(`Expected stars at rows: 2, 6`);

if (finalCol5.stars !== 2 || finalCol5.starRows.sort().join(',') !== '2,6') {
  output.push(`\n❌ Column 5 is incorrect!`);
  const outputPath = path.join(__dirname, 'column5_trace.txt');
  fs.writeFileSync(outputPath, output.join('\n'), 'utf-8');
  console.error(output.join('\n'));
  process.exit(1);
}

if (finalErrors.length > 0) {
  output.push(`\n❌ Validation errors: ${finalErrors.join('; ')}`);
  const outputPath = path.join(__dirname, 'column5_trace.txt');
  fs.writeFileSync(outputPath, output.join('\n'), 'utf-8');
  console.error(output.join('\n'));
  process.exit(1);
}

if (!finalComparison.matches) {
  output.push(`\n❌ Solution mismatch!`);
  output.push(`Missing stars: ${JSON.stringify(finalComparison.missing)}`);
  output.push(`Extra stars: ${JSON.stringify(finalComparison.extra)}`);
  const outputPath = path.join(__dirname, 'column5_trace.txt');
  fs.writeFileSync(outputPath, output.join('\n'), 'utf-8');
  console.error(output.join('\n'));
  process.exit(1);
}

output.push(`\n✅ All checks passed!`);
const outputPath = path.join(__dirname, 'column5_trace.txt');
fs.writeFileSync(outputPath, output.join('\n'), 'utf-8');
console.log(output.join('\n'));
