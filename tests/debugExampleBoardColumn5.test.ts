import { describe, it } from 'vitest';
import fs from 'node:fs';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import type { PuzzleState } from '../src/types/puzzle';

// Same regions as in testExampleBoardWithVerification.test.ts
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
  if (!hint) {
    return { applied: false, cellsChanged: [] as [number, number, string][], hint: null as any };
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

function column5Snapshot(state: PuzzleState) {
  const col = 4; // 0-indexed column 5
  const cells: Array<{ row: number; value: string }> = [];
  for (let r = 0; r < state.def.size; r += 1) {
    cells.push({ row: r, value: state.cells[r][col] });
  }
  return cells;
}

describe('Debug example board column 5 history', () => {
  it('logs column 5 crosses around the failure iterations', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const interestingIterations = new Set([2, 11, 15, 18, 19, 20, 21, 22]);
    const maxIterations = 40;
    let iteration = 0;
    const steps: any[] = [];

    while (iteration < maxIterations) {
      const { applied, cellsChanged, hint } = applyHint(state);
      if (!applied || !hint || cellsChanged.length === 0) break;

      const col5Cells = column5Snapshot(state);
      const crosses = col5Cells.filter(c => c.value === 'cross').map(c => c.row);
      const changedInCol5 = cellsChanged.filter(([, c]) => c === 4);

      if (interestingIterations.has(iteration)) {
        steps.push({
          iteration,
          technique: hint.technique,
          kind: hint.kind,
          col5CrossRows: crosses,
          changedInCol5,
        });
      }

      iteration += 1;
    }

    // Write debug info to disk so we can inspect it outside Vitest
    try {
      fs.writeFileSync(
        'debug-column5-steps.json',
        JSON.stringify(steps, null, 2),
        'utf-8',
      );
    } catch {
      // Ignore logging errors
    }
  });
});

