import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
import type { PuzzleState } from '../src/types/puzzle';

const LOG_FILE = 'vitest-example-log.txt';

function log(line: string) {
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    // ignore logging errors in tests
  }
}

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

// Expected solution from example.md
// Row 0: stars at positions 3, 6
// Row 1: stars at positions 1, 8
// Row 2: stars at positions 3, 5
// Row 3: stars at positions 0, 9
// Row 4: stars at positions 4, 6
// Row 5: stars at positions 2, 8
// Row 6: stars at positions 0, 5
// Row 7: stars at positions 2, 7
// Row 8: stars at positions 4, 9
// Row 9: stars at positions 1, 7
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

    // Persist all applied hints for offline analysis/debugging
    try {
      fs.writeFileSync(
        'vitest-example-hints.json',
        JSON.stringify(hintsApplied, null, 2),
        'utf-8',
      );
    } catch {
      // Ignore logging errors – they shouldn't fail the test
    }
  }
  return { applied: true, cellsChanged };
}

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

function verifyColumn5(state: PuzzleState, iteration: number): { isValid: boolean; message: string } {
  // Column 5 is 0-indexed column 4
  const col5Cells: Array<{ row: number; state: string }> = [];
  for (let r = 0; r < 10; r++) {
    col5Cells.push({ row: r, state: state.cells[r][4] });
  }
  const starsInCol5 = col5Cells.filter(c => c.state === 'star').length;
  const crossesInCol5 = col5Cells.filter(c => c.state === 'cross').length;

  // Expected: Column 5 (col 4, 0-indexed) should have stars at rows 4 and 8 according to EXPECTED_STARS
  const expectedStarsInCol5 = [[4, 4], [8, 4]];
  const actualStarsInCol5 = col5Cells
    .map((c, idx) => ({ row: idx, state: c.state }))
    .filter(c => c.state === 'star')
    .map(c => [c.row, 4] as [number, number]);

  // Check if column 5 has all crosses (which would be wrong)
  if (crossesInCol5 === 10) {
    return {
      isValid: false,
      message: `Column 5 (col 4) has ALL crosses at iteration ${iteration}! This is incorrect. Expected stars at rows 4 and 8.`,
    };
  }

  // Check if we have too many crosses in column 5
  if (crossesInCol5 > 8) {
    return {
      isValid: false,
      message: `Column 5 (col 4) has ${crossesInCol5} crosses at iteration ${iteration}, which seems excessive. Expected stars at rows 4 and 8.`,
    };
  }

  return { isValid: true, message: `Column 5: ${starsInCol5} stars, ${crossesInCol5} crosses` };
}

describe('Example Board Solver with Verification', () => {
  it('should solve the example board, verifying after each move', () => {
    // Clear previous log
    try { fs.unlinkSync(LOG_FILE); } catch {}
    log('=== Example Board Solver Run ===');

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
      col5Status: string;
    }> = [];

    // Apply hints until no more are found
    while (iteration < maxIterations) {
      const hint = findNextHint(state);
      if (!hint) {
        log(`No more hints found at iteration ${iteration}`);
        break;
      }

      const { applied, cellsChanged } = applyHint(state);
      if (!applied || cellsChanged.length === 0) {
        log(`Hint at iteration ${iteration} did not change any cells`);
        break;
      }

      const validationErrors = validateState(state);
      const col5Check = verifyColumn5(state, iteration);

      // Check against expected solution
      const expectedSet = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));
      const boardState = getBoardState(state);
      const actualSet = new Set(boardState.stars.map(([r, c]) => `${r},${c}`));
      
      const wrongStars = boardState.stars.filter(([r, c]) => !expectedSet.has(`${r},${c}`));
      const wrongCrosses = boardState.crosses.filter(([r, c]) => expectedSet.has(`${r},${c}`));
      const missingStars = EXPECTED_STARS.filter(([r, c]) => !actualSet.has(`${r},${c}`));

      hintsApplied.push({
        iteration,
        technique: hint.technique,
        kind: hint.kind,
        cellsChanged,
        validationErrors: [...validationErrors],
        col5Status: col5Check.message,
      });

      log(
        `Iter ${iteration}: ${hint.technique} (${hint.kind}), ` +
        `cells=${cellsChanged.length}, col5=${col5Check.message}`,
      );
      log(`    cellsChanged=${JSON.stringify(cellsChanged)}`);
      
      // Log errors immediately when they occur
      if (wrongStars.length > 0 || wrongCrosses.length > 0) {
        log(`\n❌ ERROR AT ITERATION ${iteration}:`);
        log(`   Technique: ${hint.technique} (${hint.kind})`);
        log(`   Cells changed: ${JSON.stringify(cellsChanged)}`);
        if (wrongStars.length > 0) {
          log(`   WRONG STARS: ${JSON.stringify(wrongStars)}`);
        }
        if (wrongCrosses.length > 0) {
          log(`   WRONG CROSSES (should be stars): ${JSON.stringify(wrongCrosses)}`);
        }
        if (missingStars.length > 0) {
          log(`   Missing stars: ${JSON.stringify(missingStars)}`);
        }
      }

      if (validationErrors.length > 0) {
        const boardState = getBoardState(state);
        log(`VALIDATION ERROR at iter ${iteration}: ${validationErrors.join(' | ')}`);
        log(`Stars: ${JSON.stringify(boardState.stars)}`);
        log(`Crosses: ${JSON.stringify(boardState.crosses)}`);
        expect(validationErrors).toEqual([]);
      }

      if (!col5Check.isValid) {
        const boardState = getBoardState(state);
        log(`COLUMN 5 ISSUE at iter ${iteration}: ${col5Check.message}`);
        log(`Stars: ${JSON.stringify(boardState.stars)}`);
        log(`Crosses: ${JSON.stringify(boardState.crosses)}`);
        for (let r = 0; r < 10; r++) {
          const cellState = state.cells[r][4];
          const marker = cellState === 'star' ? 'S' : cellState === 'cross' ? '×' : '.';
          log(`  Col5 Row ${r}: ${marker}`);
        }
        expect(col5Check.isValid).toBe(true);
      }

      const col5Changed = cellsChanged.some(([_, c]) => c === 4);
      if (iteration % 10 === 0 || col5Changed) {
        log(`Progress iter ${iteration}: ${hint.technique} (${hint.kind})`);
      }

      iteration++;
    }

    log(`SOLVER COMPLETED, iterations=${iteration}`);
    const boardState = getBoardState(state);
    log(`Final stars: ${boardState.stars.length}`);
    log(`Final crosses: ${boardState.crosses.length}`);

    const finalStars = boardState.stars;
    expect(finalStars.length).toBe(20);

    const finalValidationErrors = validateState(state);
    if (finalValidationErrors.length > 0) {
      log(`Final validation errors: ${finalValidationErrors.join(' | ')}`);
      expect(finalValidationErrors).toEqual([]);
    }

    const expectedSet = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));
    const actualSet = new Set(finalStars.map(([r, c]) => `${r},${c}`));
    const missing = EXPECTED_STARS.filter(([r, c]) => !actualSet.has(`${r},${c}`));
    const extra = finalStars.filter(([r, c]) => !expectedSet.has(`${r},${c}`));

    if (missing.length > 0 || extra.length > 0) {
      log('SOLUTION MISMATCH');
      log(`Missing: ${JSON.stringify(missing)}`);
      log(`Extra: ${JSON.stringify(extra)}`);
      log(`Expected: ${JSON.stringify(EXPECTED_STARS)}`);
      log(`Actual: ${JSON.stringify(finalStars)}`);
      log('Final board:');
      for (let r = 0; r < 10; r++) {
        let row = '';
        for (let c = 0; c < 10; c++) {
          if (state.cells[r][c] === 'star') row += 'S ';
          else if (state.cells[r][c] === 'cross') row += '× ';
          else row += '. ';
        }
        log(row.trim());
      }
    }

    expect(missing.length).toBe(0);
    expect(extra.length).toBe(0);
  });
});
