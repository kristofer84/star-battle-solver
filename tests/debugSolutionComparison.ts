import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
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

const EXPECTED_STARS_SET = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));

function getBoardState(state: PuzzleState): { stars: [number, number][]; crosses: [number, number][] } {
  const stars: [number, number][] = [];
  const crosses: [number, number][] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (state.cells[r][c] === 'star') stars.push([r, c]);
      else if (state.cells[r][c] === 'cross') crosses.push([r, c]);
    }
  }
  return { stars, crosses };
}

function checkAgainstExpected(state: PuzzleState, iteration: number): { 
  wrongStars: [number, number][]; 
  wrongCrosses: [number, number][];
  missingStars: [number, number][];
} {
  const boardState = getBoardState(state);
  const wrongStars: [number, number][] = [];
  const wrongCrosses: [number, number][] = [];
  const missingStars: [number, number][] = [];

  // Check stars
  for (const star of boardState.stars) {
    if (!EXPECTED_STARS_SET.has(`${star[0]},${star[1]}`)) {
      wrongStars.push(star);
    }
  }

  // Check for missing stars
  for (const expectedStar of EXPECTED_STARS) {
    if (state.cells[expectedStar[0]][expectedStar[1]] !== 'star') {
      missingStars.push(expectedStar);
    }
  }

  // Check crosses that should be stars
  for (const cross of boardState.crosses) {
    if (EXPECTED_STARS_SET.has(`${cross[0]},${cross[1]}`)) {
      wrongCrosses.push(cross);
    }
  }

  return { wrongStars, wrongCrosses, missingStars };
}

describe('Debug Solution Comparison', () => {
  it('should track each step and compare against expected solution', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const maxIterations = 500;
    let iteration = 0;
    const errors: Array<{
      iteration: number;
      technique: string;
      kind: string;
      cellsChanged: [number, number, string][];
      wrongStars: [number, number][];
      wrongCrosses: [number, number][];
      missingStars: [number, number][];
    }> = [];

    while (iteration < maxIterations) {
      const hint = findNextHint(state);
      if (!hint) {
        console.log(`No more hints found at iteration ${iteration}`);
        break;
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

      if (cellsChanged.length === 0) {
        console.log(`Hint at iteration ${iteration} did not change any cells`);
        break;
      }

      const check = checkAgainstExpected(state, iteration);
      
      if (check.wrongStars.length > 0 || check.wrongCrosses.length > 0 || check.missingStars.length > 0) {
        errors.push({
          iteration,
          technique: hint.technique,
          kind: hint.kind,
          cellsChanged,
          wrongStars: check.wrongStars,
          wrongCrosses: check.wrongCrosses,
          missingStars: check.missingStars,
        });

        // Log to both console and file
        const errorMsg = [
          `\n=== ERROR AT ITERATION ${iteration} ===`,
          `Technique: ${hint.technique} (${hint.kind})`,
          `Cells changed: ${JSON.stringify(cellsChanged)}`,
          check.wrongStars.length > 0 ? `❌ WRONG STARS placed: ${JSON.stringify(check.wrongStars)}` : '',
          check.wrongCrosses.length > 0 ? `❌ WRONG CROSSES placed (should be stars): ${JSON.stringify(check.wrongCrosses)}` : '',
          check.missingStars.length > 0 ? `⚠️  Missing stars: ${JSON.stringify(check.missingStars)}` : '',
        ].filter(Boolean).join('\n');
        console.log(errorMsg);
        fs.appendFileSync('debug-errors.log', errorMsg + '\n');
      }

      const validationErrors = validateState(state);
      if (validationErrors.length > 0) {
        console.log(`\n=== VALIDATION ERROR AT ITERATION ${iteration} ===`);
        console.log(`Errors: ${validationErrors.join(' | ')}`);
        break;
      }

      iteration++;
    }

    console.log(`\n=== FINAL STATE ===`);
    const finalCheck = checkAgainstExpected(state, iteration);
    const boardState = getBoardState(state);
    console.log(`Total iterations: ${iteration}`);
    console.log(`Final stars: ${boardState.stars.length} (expected: 20)`);
    console.log(`Final crosses: ${boardState.crosses.length}`);
    console.log(`Wrong stars: ${finalCheck.wrongStars.length}`);
    console.log(`Wrong crosses: ${finalCheck.wrongCrosses.length}`);
    console.log(`Missing stars: ${finalCheck.missingStars.length}`);

    if (finalCheck.wrongStars.length > 0) {
      console.log(`Wrong stars: ${JSON.stringify(finalCheck.wrongStars)}`);
    }
    if (finalCheck.wrongCrosses.length > 0) {
      console.log(`Wrong crosses: ${JSON.stringify(finalCheck.wrongCrosses)}`);
    }
    if (finalCheck.missingStars.length > 0) {
      console.log(`Missing stars: ${JSON.stringify(finalCheck.missingStars)}`);
    }

    // Write errors to file for analysis
    fs.writeFileSync(
      'debug-solution-errors.json',
      JSON.stringify(errors, null, 2),
      'utf-8'
    );

    expect(finalCheck.wrongStars.length).toBe(0);
    expect(finalCheck.wrongCrosses.length).toBe(0);
  });
});
