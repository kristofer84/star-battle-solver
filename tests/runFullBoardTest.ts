import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
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

function applyHint(state: PuzzleState): { applied: boolean; cellsChanged: [number, number, string][] } {
  const hint = findNextHint(state);
  if (!hint) {
    return { applied: false, cellsChanged: [] };
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
  
  return { applied: true, cellsChanged };
}

function getBoardState(state: PuzzleState): { stars: [number, number][]; crosses: [number, number][] } {
  const stars: [number, number][] = [];
  const crosses: [number, number][] = [];
  
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (state.cells[r][c] === 'star') {
        stars.push([r, c]);
      } else if (state.cells[r][c] === 'cross') {
        crosses.push([r, c]);
      }
    }
  }
  
  return { stars, crosses };
}

console.log('=== Starting Full Board Test ===\n');

const state = createEmptyPuzzleState({
  size: 10,
  starsPerUnit: 2,
  regions: EXAMPLE_REGIONS,
});

const maxIterations = 500;
let iteration = 0;
const hintsApplied: Array<{
  iteration: number;
  technique: string;
  kind: string;
  cellsChanged: [number, number, string][];
  validationErrors: string[];
}> = [];

while (iteration < maxIterations) {
  const hint = findNextHint(state);
  if (!hint) {
    console.log(`No more hints found at iteration ${iteration}`);
    break;
  }

  const { applied, cellsChanged } = applyHint(state);
  
  if (!applied || cellsChanged.length === 0) {
    console.log(`Hint at iteration ${iteration} did not change any cells`);
    break;
  }

  const validationErrors = validateState(state);
  
  hintsApplied.push({
    iteration,
    technique: hint.technique,
    kind: hint.kind,
    cellsChanged,
    validationErrors: [...validationErrors],
  });

  if (validationErrors.length > 0) {
    const boardState = getBoardState(state);
    console.error(`\n=== VALIDATION ERROR AT ITERATION ${iteration} ===`);
    console.error(`Technique: ${hint.technique}`);
    console.error(`Kind: ${hint.kind}`);
    console.error(`Cells changed:`, cellsChanged);
    console.error(`Validation errors:`, validationErrors);
    console.error(`Current stars (${boardState.stars.length}):`, boardState.stars);
    console.error(`Current crosses (${boardState.crosses.length}):`, boardState.crosses);
    process.exit(1);
  }

  if (iteration % 10 === 0 || cellsChanged.length > 5) {
    const boardState = getBoardState(state);
    console.log(`Iteration ${iteration}: ${hint.technique} (${hint.kind}) - ${cellsChanged.length} cells changed - Stars: ${boardState.stars.length}, Crosses: ${boardState.crosses.length}`);
  }

  iteration++;
}

console.log(`\n=== SOLVER COMPLETED ===`);
console.log(`Total hints applied: ${iteration}`);
console.log(`Techniques used:`, [...new Set(hintsApplied.map(h => h.technique))]);

const boardState = getBoardState(state);
console.log(`Final stars: ${boardState.stars.length}`);
console.log(`Final crosses: ${boardState.crosses.length}`);

const finalValidationErrors = validateState(state);
if (finalValidationErrors.length > 0) {
  console.error('Final validation errors:', finalValidationErrors);
  process.exit(1);
}

const expectedSet = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));
const actualSet = new Set(boardState.stars.map(([r, c]) => `${r},${c}`));

const missing = EXPECTED_STARS.filter(([r, c]) => !actualSet.has(`${r},${c}`));
const extra = boardState.stars.filter(([r, c]) => !expectedSet.has(`${r},${c}`));

if (missing.length > 0 || extra.length > 0) {
  console.error('\n=== SOLUTION MISMATCH ===');
  console.error('Missing stars:', missing);
  console.error('Extra stars:', extra);
  process.exit(1);
}

console.log('\n✅ Test PASSED - Solution matches expected!');
