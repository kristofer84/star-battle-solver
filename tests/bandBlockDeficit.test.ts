import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findBandBlockDeficitHint } from '../src/logic/techniques/bandBlockDeficit';

function parsePuzzle(puzzleStr: string): PuzzleState {
  const lines = puzzleStr.trim().split('\n').map((line) => line.trim());
  const regions: number[][] = [];

  for (let r = 0; r < 10; r += 1) {
    const cells = lines[r].split(/\s+/);
    const regionRow: number[] = [];
    for (let c = 0; c < 10; c += 1) {
      const match = cells[c].match(/^(\d+)([xs]?)$/);
      if (!match) throw new Error(`Bad cell at (${r},${c}): ${cells[c]}`);
      regionRow.push(parseInt(match[1], 10));
    }
    regions.push(regionRow);
  }

  const state = createEmptyPuzzleState({ size: 10, starsPerUnit: 2, regions });

  for (let r = 0; r < 10; r += 1) {
    const cells = lines[r].split(/\s+/);
    for (let c = 0; c < 10; c += 1) {
      const match = cells[c].match(/^(\d+)([xs]?)$/);
      if (!match) continue;
      const marker = match[2];
      if (marker === 's') state.cells[r][c] = 'star';
      else if (marker === 'x') state.cells[r][c] = 'cross';
    }
  }

  return state;
}

describe('Band Block Deficit', () => {
  it('forces (2,4) to be a cross via cols 2+3 with two 2x2 blocks', () => {
    // From the user's puzzle: cols 2+3 need 4 stars, 1 placed (9,2)=star.
    // Two disjoint star-free 2x2 blocks at rows 4-5 and rows 6-7 cap their
    // empties at ≤2 stars between them. The remaining empties (1,3), (2,3),
    // (3,3) must contain ≥1 star, and (2,4) is 8-adjacent to all three.
    const puzzleStr = `0x 0x 0x 0x 0x 1s 1x 2s 2x 2x
0x 0 0x 3 3x 3x 1x 1x 1x 2s
0x 0 0x 3 4 3 3 1 5x 5x
0x 0 0x 0 4 3x 6 1x 1 5
4x 4 4x 4 4 3x 6 6x 1x 5
7 8x 8 4 3x 3 8 6 6 5
7 8x 8 4x 4 3 8 5x 5x 5
7 8x 8 8 8 3 8 5x 5 5
7 7x 7x 9x 8x 8x 8 5 5 8x
7x 7x 9s 9x 9s 8x 8x 8x 8x 8x`;

    const state = parsePuzzle(puzzleStr);
    const hint = findBandBlockDeficitHint(state);

    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.technique).toBe('band-block-deficit');
    expect(hint?.resultCells).toEqual([{ row: 2, col: 4 }]);
  });

  it('returns null for an empty puzzle (no constraints yet)', () => {
    const regions = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 0));
    const state = createEmptyPuzzleState({ size: 10, starsPerUnit: 2, regions });
    const hint = findBandBlockDeficitHint(state);
    expect(hint).toBeNull();
  });

  it('does not place an excluded star inside the band itself', () => {
    const puzzleStr = `0x 0x 0x 0x 0x 1s 1x 2s 2x 2x
0x 0 0x 3 3x 3x 1x 1x 1x 2s
0x 0 0x 3 4 3 3 1 5x 5x
0x 0 0x 0 4 3x 6 1x 1 5
4x 4 4x 4 4 3x 6 6x 1x 5
7 8x 8 4 3x 3 8 6 6 5
7 8x 8 4x 4 3 8 5x 5x 5
7 8x 8 8 8 3 8 5x 5 5
7 7x 7x 9x 8x 8x 8 5 5 8x
7x 7x 9s 9x 9s 8x 8x 8x 8x 8x`;

    const state = parsePuzzle(puzzleStr);
    const hint = findBandBlockDeficitHint(state);
    // The forced cross must be outside the band (cols 2 and 3).
    for (const cell of hint?.resultCells ?? []) {
      expect(cell.col === 2 || cell.col === 3).toBe(false);
    }
  });
});
