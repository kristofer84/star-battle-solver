// This script tests the UI by calling the same functions the UI uses
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
import { applyHintToState } from '../src/store/puzzleStore';
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

function getColumn5State(state: PuzzleState): {
  stars: number;
  crosses: number;
  empties: number;
  cellStates: string;
} {
  const col = colCells(state, 4);
  const stars = countStars(state, col);
  const empties = emptyCells(state, col);
  const crosses = col.length - stars - empties.length;
  
  const cellStates = col.map(c => {
    const val = state.cells[c.row][c.col];
    return val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
  }).join('');
  
  return { stars, crosses, empties, cellStates };
}

console.log('=== Testing UI Engine (same as UI uses) ===\n');
console.log('Expected stars in column 5: rows 2 and 6 (0-indexed)\n');

// Create state exactly as UI would
const state = createEmptyPuzzleState({
  size: 10,
  starsPerUnit: 2,
  regions: EXAMPLE_REGIONS,
});

let iteration = 0;
const maxIterations = 300;

while (iteration < maxIterations) {
  // Use the same function the UI uses
  const hint = findNextHint(state);
  if (!hint) {
    console.log(`\nNo more hints at iteration ${iteration}`);
    break;
  }

  const col5Before = getColumn5State(state);
  const technique = hint.technique;
  const kind = hint.kind;
  
  // Use the same function the UI uses to apply hints
  applyHintToState(hint);
  
  const col5After = getColumn5State(state);
  const errors = validateState(state);
  
  // Check if column 5 changed
  const col5Changed = col5Before.cellStates !== col5After.cellStates;
  const col5CellsChanged = hint.resultCells.some(c => c.col === 4);
  
  if (col5Changed || col5CellsChanged) {
    console.log(`\nIteration ${iteration}: ${technique} (${kind})`);
    console.log(`  Column 5 before: ${col5Before.stars} stars, ${col5Before.crosses} crosses, ${col5Before.empties} empty | ${col5Before.cellStates}`);
    console.log(`  Column 5 after:  ${col5After.stars} stars, ${col5After.crosses} crosses, ${col5After.empties} empty | ${col5After.cellStates}`);
    
    const changedInCol5 = hint.resultCells.filter(c => c.col === 4);
    if (changedInCol5.length > 0) {
      console.log(`  Changed in col 5: ${changedInCol5.map(c => `(${c.row},${c.col})=${kind === 'place-star' ? 'star' : 'cross'}`).join(', ')}`);
    }
    
    // Check for all crosses
    if (col5After.crosses === 10) {
      console.error(`\n❌❌❌ COLUMN 5 HAS ALL CROSSES! ❌❌❌`);
      console.error(`  Technique: ${technique} (${kind})`);
      console.error(`  Validation errors: ${errors.join('; ')}`);
      console.error(`  Column 5 state: ${col5After.cellStates}`);
      console.error(`  Expected stars at rows: 2, 6`);
      process.exit(1);
    }
    
    if (errors.length > 0) {
      console.error(`  ⚠️  Validation errors: ${errors.join('; ')}`);
    }
  }

  iteration++;
}

// Final verification
const finalCol5 = getColumn5State(state);
console.log(`\n=== Final Results ===`);
console.log(`Total iterations: ${iteration}`);
console.log(`Column 5: ${finalCol5.stars} stars, ${finalCol5.crosses} crosses, ${finalCol5.empties} empty`);
console.log(`Column 5 state: ${finalCol5.cellStates}`);

const col = colCells(state, 4);
const finalStars = col
  .map((c, idx) => ({ row: c.row, val: state.cells[c.row][c.col] }))
  .filter(c => c.val === 'star')
  .map(c => c.row);

console.log(`Column 5 stars at rows: ${finalStars.join(', ')}`);
console.log(`Expected stars at rows: 2, 6`);

if (finalCol5.stars !== 2 || finalStars.sort().join(',') !== '2,6') {
  console.error(`\n❌ Column 5 is incorrect!`);
  process.exit(1);
}

const finalErrors = validateState(state);
if (finalErrors.length > 0) {
  console.error(`\n❌ Validation errors:`, finalErrors);
  process.exit(1);
}

console.log(`\n✅ All checks passed!`);
