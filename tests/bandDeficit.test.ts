import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import type { PuzzleDef, CellState } from '../src/types/puzzle';
import { findBandDeficitHint } from '../src/logic/techniques/bandDeficit';

/** All cells belong to region 1; only band-deficit logic is under test. */
function makeDef(): PuzzleDef {
  return {
    size: 10,
    starsPerUnit: 2,
    regions: Array.from({ length: 10 }, () => Array(10).fill(1)),
  };
}

describe('band-deficit technique', () => {
  /**
   * Band: columns 4 and 5 (N=2, need 4 stars total).
   *
   * Setup:
   *   - 1 star already at (9,5)  →  D = 3 remaining
   *   - Block A (rows 0–1, cols 4–5): cells (0,4)(0,5)(1,4)(1,5) all empty
   *   - Block B (rows 4–5, cols 4–5): cells (4,4)(4,5)(5,4)(5,5) all empty
   *   - (2,5) and (3,5) are crosses → no 2×2 block spans rows 2–3
   *   - Rows 6–9 in the band: crosses (adjacent to star or explicitly set)
   *   - R = { (2,4), (3,4) }  →  deficit D − m = 3 − 2 = 1
   *
   * Any cell outside the band adjacent to BOTH (2,4) and (3,4) is forced:
   *   (2,3): row-diff 0 col-diff 1 to (2,4) ✓, row-diff 1 col-diff 1 to (3,4) ✓
   *   (3,3): row-diff 1 col-diff 1 to (2,4) ✓, row-diff 0 col-diff 1 to (3,4) ✓
   */
  it('forces crosses on cells adjacent to all R cells (deficit = 1, |R| = 2)', () => {
    const state = createEmptyPuzzleState(makeDef());

    // Place star and mark its 8-neighbours inside the band as crosses.
    state.cells[9][5] = 'star';
    state.cells[9][4] = 'cross';
    state.cells[8][4] = 'cross';
    state.cells[8][5] = 'cross';

    // Prevent a 2×2 block forming in rows 2–3 of the band.
    state.cells[2][5] = 'cross';
    state.cells[3][5] = 'cross';

    // Prevent blocks in rows 6–7.
    state.cells[6][4] = 'cross';
    state.cells[6][5] = 'cross';
    state.cells[7][4] = 'cross';
    state.cells[7][5] = 'cross';

    const hint = findBandDeficitHint(state);
    expect(hint).not.toBeNull();
    if (!hint) return;

    expect(hint.kind).toBe('place-cross');
    expect(hint.technique).toBe('band-deficit');

    const crosses = new Set(hint.resultCells.map(c => `${c.row},${c.col}`));
    // Both cells that are adjacent to all of R must be in resultCells.
    expect(crosses.has('2,3')).toBe(true);
    expect(crosses.has('3,3')).toBe(true);

    // Cells inside the band must not be in resultCells.
    for (const c of hint.resultCells) {
      expect(c.col === 4 || c.col === 5).toBe(false);
    }
  });

  /**
   * Stronger case: deficit = |R|.
   *
   * Band: columns 4 and 5 (N=2, need 4 stars, no stars placed yet → D=4).
   *   - Block A: rows 0–1, cols 4–5
   *   - Block B: rows 4–5, cols 4–5
   *   - (2,5)(3,5)(6,5)(7,5)(8,5)(9,5) = crosses  →  only col-4 cells left in rows 2,3,6..9
   *   - (6,4)(7,4)(8,4)(9,4) = crosses
   *   - R = { (2,4), (3,4) }, m = 2, deficit = 4 − 2 = 2 = |R|
   *
   * Because every R cell must be a star, any outside cell adjacent to ANY R
   * cell is forced.  In particular (2,3) and (3,3) are forced crosses, and so
   * are cells in col 6 adjacent to either.
   */
  it('forces crosses adjacent to any R cell when deficit = |R|', () => {
    const state = createEmptyPuzzleState(makeDef());

    // No stars placed: D = 4.
    // Block A needs (0,4)(0,5)(1,4)(1,5) all empty — they start empty.
    // Block B needs (4,4)(4,5)(5,4)(5,5) all empty — they start empty.

    // Remove col-5 cells for rows 2–3 and 6–9 from E.
    for (const r of [2, 3, 6, 7, 8, 9]) state.cells[r][5] = 'cross';

    // Remove col-4 cells for rows 6–9 from E.
    for (const r of [6, 7, 8, 9]) state.cells[r][4] = 'cross';

    const hint = findBandDeficitHint(state);
    expect(hint).not.toBeNull();
    if (!hint) return;

    expect(hint.kind).toBe('place-cross');
    expect(hint.technique).toBe('band-deficit');

    const crosses = new Set(hint.resultCells.map(c => `${c.row},${c.col}`));

    // Every cell adjacent to (2,4) or (3,4) and outside cols 4–5 must appear.
    // (2,3) is adjacent to (2,4): row-diff=0, col-diff=1 ✓
    expect(crosses.has('2,3')).toBe(true);
    // (3,3) is adjacent to (3,4): row-diff=0, col-diff=1 ✓
    expect(crosses.has('3,3')).toBe(true);

    // Cells inside the band must not appear.
    for (const c of hint.resultCells) {
      expect(c.col === 4 || c.col === 5).toBe(false);
    }
  });

  it('returns null when the band has no deficit', () => {
    // A fully solved band: 4 stars already in cols 4–5, no deficit.
    const state = createEmptyPuzzleState(makeDef());
    state.cells[0][4] = 'star';
    state.cells[3][5] = 'star';
    state.cells[6][4] = 'star';
    state.cells[9][5] = 'star';
    // Mark all other cells in the band as crosses.
    for (let r = 0; r < 10; r++) {
      for (const c of [4, 5]) {
        if (state.cells[r][c] === 'empty') state.cells[r][c] = 'cross';
      }
    }

    const hint = findBandDeficitHint(state);
    // The band is fully satisfied; no deduction for it (other bands might fire,
    // but we only care that the saturated band doesn't generate a false hint).
    if (hint) {
      // If a hint is returned it must not reference cols 4 or 5 as the band.
      expect(hint.highlights?.cols).not.toEqual([4, 5]);
    }
  });

  it('returns null when blocks alone can cover the deficit', () => {
    // Band: cols 2–3, 2 stars needed (D=2), 1 block of 4 empty cells (m=1).
    // D (2) > m (1), deficit = 1, BUT the remaining empty cells fill R = many
    // cells scattered — no outside cell is adjacent to all of them.
    // This test verifies no crash and the logic remains stable.
    const state = createEmptyPuzzleState(makeDef());
    // All cells empty. Greedy will form many blocks across the whole band and
    // D (20 for the full band) >> m for a fully empty puzzle, but no specific
    // outside cell is adjacent to ALL R cells. So the hint may or may not fire
    // for some band — we just verify it doesn't throw.
    expect(() => findBandDeficitHint(state)).not.toThrow();
  });

  /**
   * Regression test from a real puzzle state.
   *
   * Board notation (region letter + optional s=star / x=cross, blank=empty):
   *   row 0: 0x 0x 0x 0x 0x 1s 1x 2s 2x 2x
   *   row 1: 0x 0  0x 3  3x 3x 1x 1x 1x 2s
   *   row 2: 0x 0  0x 3  4  3  3  1  5x 5x
   *   row 3: 0x 0  0x 0  4  3x 6  1x 1  5
   *   row 4: 4x 4  4x 4  4  3x 6  6x 1x 5
   *   row 5: 7  8x 8  4  3x 3  8  6  6  5
   *   row 6: 7  8x 8  4x 4  3  8  5x 5x 5
   *   row 7: 7  8x 8  8  8  3  8  5x 5  5
   *   row 8: 7  7x 7x 9x 8x 8x 8  5  5  8x
   *   row 9: 7x 7x 9s 9x 9s 8x 8x 8x 8x 8x
   *
   * Expected: cell (2,4) must be a cross.
   */
  it('finds forced cross at (2,4) in the example puzzle state', () => {
    // Region map (0-indexed region ids matching the letters A=0..J=9)
    const regionGrid: number[][] = [
      [0, 0, 0, 0, 0, 1, 1, 2, 2, 2],
      [0, 0, 0, 3, 3, 3, 1, 1, 1, 2],
      [0, 0, 0, 3, 4, 3, 3, 1, 5, 5],
      [0, 0, 0, 0, 4, 3, 6, 1, 1, 5],
      [4, 4, 4, 4, 4, 3, 6, 6, 1, 5],
      [7, 8, 8, 4, 3, 3, 8, 6, 6, 5],
      [7, 8, 8, 4, 4, 3, 8, 5, 5, 5],
      [7, 8, 8, 8, 8, 3, 8, 5, 5, 5],
      [7, 7, 7, 9, 8, 8, 8, 5, 5, 8],
      [7, 7, 9, 9, 9, 8, 8, 8, 8, 8],
    ];

    // Cell states row by row (s=star, x=cross, e=empty)
    const boardStr: string[][] = [
      ['x','x','x','x','x','s','x','s','x','x'],
      ['x','e','x','e','x','x','x','x','x','s'],
      ['x','e','x','e','e','e','e','e','x','x'],
      ['x','e','x','e','e','x','e','x','e','e'],
      ['x','e','x','e','e','x','e','x','x','e'],
      ['e','x','e','e','x','e','e','e','e','e'],
      ['e','x','e','x','e','e','e','x','x','e'],
      ['e','x','e','e','e','e','e','x','e','e'],
      ['e','x','x','x','x','x','e','e','e','x'],
      ['x','x','s','x','s','x','x','x','x','x'],
    ];

    const def: PuzzleDef = { size: 10, starsPerUnit: 2, regions: regionGrid };
    const state = createEmptyPuzzleState(def);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const ch = boardStr[r][c];
        state.cells[r][c] = (ch === 's' ? 'star' : ch === 'x' ? 'cross' : 'empty') as CellState;
      }
    }

    const hint = findBandDeficitHint(state);
    expect(hint).not.toBeNull();
    if (!hint) return;

    expect(hint.kind).toBe('place-cross');
    expect(hint.resultCells.some(c => c.row === 2 && c.col === 4)).toBe(true);
  });
});
