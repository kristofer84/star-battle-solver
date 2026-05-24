import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';

function parsePuzzle(puzzleStr: string): PuzzleState {
  const lines = puzzleStr.trim().split('\n').map((l) => l.trim());
  const regions: number[][] = [];
  for (let r = 0; r < 10; r += 1) {
    const cells = lines[r].split(/\s+/);
    const regionRow: number[] = [];
    for (let c = 0; c < 10; c += 1) {
      const m = cells[c].match(/^(\d+)([xs]?)$/);
      if (!m) throw new Error(`Bad cell at (${r},${c}): ${cells[c]}`);
      regionRow.push(parseInt(m[1], 10));
    }
    regions.push(regionRow);
  }

  const state = createEmptyPuzzleState({ size: 10, starsPerUnit: 2, regions });
  for (let r = 0; r < 10; r += 1) {
    const cells = lines[r].split(/\s+/);
    for (let c = 0; c < 10; c += 1) {
      const m = cells[c].match(/^(\d+)([xs]?)$/);
      if (!m) continue;
      const marker = m[2];
      if (marker === 's') state.cells[r][c] = 'star';
      else if (marker === 'x') state.cells[r][c] = 'cross';
    }
  }
  return state;
}

describe('User puzzle: (3,4) cross via combined constraints', () => {
  // The puzzle the user described:
  //   - Region 0 needs a star in row 3 (its row-1/2 cells can fit at most one
  //     of its two stars by adjacency, so the second lands in row 3).
  //   - The 2×2 at rows 2-3, cols 8-9 must contain a star (col-9 case-split:
  //     either (3,9) is the col-9 star, or (7,9) is and then col-8 cascades
  //     into (3,8)).
  //   - Row 3 needs 2 stars total; these two disjoint subsets account for
  //     both, leaving (3,4) as a cross.
  const puzzle = `0x 0x 0x 0x 0x 1s 1x 2s 2x 2x
0x 0 0x 3 3x 3x 1x 1x 1x 2s
0x 0 0x 3 4x 3 3 1 5x 5x
0x 0 0x 0 4 3x 6x 1x 1 5
4x 4 4x 4 4 3x 6s 6x 1x 5x
7 8x 8 4 3x 3x 8x 6x 6s 5x
7 8x 8 4x 4 3 8 5x 5x 5x
7 8x 8 8 8 3x 8 5x 5 5
7 7x 7x 9x 8x 8x 8 5 5 8x
7x 7x 9s 9x 9s 8x 8x 8x 8x 8x`;

  it('eventually derives (3,4) as a cross', async () => {
    const state = parsePuzzle(puzzle);

    // Iterate hints up to a small bound; we expect (3,4) to be crossed.
    for (let iter = 0; iter < 50; iter += 1) {
      const hint = await findNextHint(state);
      if (!hint) break;
      for (const c of hint.resultCells) {
        if (state.cells[c.row][c.col] !== 'empty') continue;
        state.cells[c.row][c.col] = hint.kind === 'place-star' ? 'star' : 'cross';
      }
      if (state.cells[3][4] === 'cross') {
        // Record which technique fired the deduction for clarity.
        // eslint-disable-next-line no-console
        process.stderr.write(`(3,4) crossed after ${iter + 1} hints by ${hint.technique}\n`);
        return;
      }
    }

    throw new Error(`(3,4) was not crossed within hint budget; current state: ${state.cells[3][4]}`);
  });
});
