import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findAdjacentExclusionHint } from '../src/logic/techniques/adjacentExclusion';

const regions = [
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [0, 2, 2, 2, 2, 2, 1, 1, 1, 1],
  [2, 2, 3, 4, 4, 4, 1, 1, 5, 5],
  [2, 2, 3, 4, 4, 4, 5, 5, 5, 5],
  [2, 6, 3, 3, 3, 4, 4, 4, 5, 5],
  [7, 6, 3, 3, 3, 3, 3, 4, 5, 9],
  [7, 6, 6, 6, 3, 4, 4, 4, 5, 9],
  [7, 6, 6, 6, 3, 3, 3, 4, 8, 9],
  [7, 6, 7, 6, 8, 8, 8, 8, 8, 9],
  [7, 7, 7, 8, 8, 9, 9, 9, 9, 9],
];

const state = createEmptyPuzzleState({
  size: 10,
  starsPerUnit: 2,
  regions,
});

// Mark all cells as cross first
for (let r = 0; r < 10; r++) {
  for (let c = 0; c < 10; c++) {
    state.cells[r][c] = 'cross';
  }
}

// Mark region 7 cells as empty: {7,0}, {8,0}, {8,2}, {9,0}, {9,1}, {9,2}
state.cells[7][0] = 'empty'; // {7,0} - region 7
state.cells[8][0] = 'empty'; // {8,0} - region 7
state.cells[8][2] = 'empty'; // {8,2} - region 7
state.cells[9][0] = 'empty'; // {9,0} - region 7
state.cells[9][1] = 'empty'; // {9,1} - region 7
state.cells[9][2] = 'empty'; // {9,2} - region 7

// Mark {8,1} as empty - this should be detected as needing a cross
// {8,1} is in region 6, not region 7
state.cells[8][1] = 'empty';

console.log('Testing adjacent exclusion for {8,1}...\n');

const hint = findAdjacentExclusionHint(state);

if (hint) {
  console.log('✓ Found hint!');
  console.log('Result cells:', hint.resultCells);
  console.log('Explanation:', hint.explanation);
  const has81 = hint.resultCells.some(c => c.row === 8 && c.col === 1);
  if (has81) {
    console.log('✓ Correctly found {8,1}');
  } else {
    console.log('✗ Did not find {8,1}, found:', hint.resultCells);
  }
} else {
  console.log('✗ No hint found');
}
