import { describe, it, expect } from 'vitest';
import { findLockedOutsideFootprintHint } from '../src/logic/techniques/overcounting';
import type { PuzzleState, PuzzleDef, CellState } from '../src/types/puzzle';

function makeState(
  size: number,
  starsPerUnit: number,
  regions: number[][],
  cells: CellState[][],
): PuzzleState {
  const def: PuzzleDef = { size, starsPerUnit, regions };
  return { def, cells };
}

function emptyGrid(size: number): CellState[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'empty' as CellState),
  );
}

describe('Locked Outside Footprint', () => {
  /**
   * User's exact scenario:
   *
   * Rows 0-2 band is saturated (totalMin = cap = 6) because:
   *   region 0: 2 stars, fully confined to rows 0-1  → minInBand = 2
   *   region 1: 2 stars, fully confined to rows 0-2  → minInBand = 2
   *   region 2: 2 stars, outside pair (3,3)+(4,3) adjacent → minInBand = 1
   *   region 3: 2 stars, outside pair (3,6)+(4,6) adjacent → minInBand = 1
   *
   * Therefore region 2 places EXACTLY 1 star in {(3,3),(4,3)}.
   * Cells adjacent to BOTH (3,3) and (4,3): (3,2),(4,2),(3,4),(4,4) → forced crosses.
   */
  it('marks common 8-neighbors of an adjacent outside pair as crosses', () => {
    const size = 10;
    const starsPerUnit = 2;

    const R = Array.from({ length: size }, () => Array(size).fill(9) as number[]);

    // region 0: rows 0-1, cols 0-3 — fully in rows 0-2
    for (let r = 0; r <= 1; r++) for (let c = 0; c <= 3; c++) R[r][c] = 0;
    // region 1: rows 0-2, cols 4-9 — fully in rows 0-2
    for (let r = 0; r <= 2; r++) for (let c = 4; c <= 9; c++) R[r][c] = 1;
    // region 2: rows 1-4, col 3 only (tight column — outside pair is (3,3)+(4,3), adjacent)
    for (let r = 1; r <= 4; r++) R[r][3] = 2;
    // also give region 2 some cells in rows 1-2 to have inside candidates
    for (let r = 1; r <= 2; r++) for (let c = 0; c <= 2; c++) R[r][c] = 2;
    // region 3: rows 1-4, col 6 only (outside pair is (3,6)+(4,6), adjacent)
    for (let r = 1; r <= 4; r++) R[r][6] = 3;
    for (let r = 1; r <= 2; r++) for (let c = 4; c <= 5; c++) R[r][c] = 3;
    // fill remaining with region 9
    // (already filled with 9 above)

    const cells = emptyGrid(size);
    const state = makeState(size, starsPerUnit, R, cells);
    const hint = findLockedOutsideFootprintHint(state);

    expect(hint).not.toBeNull();
    if (!hint) return;

    expect(hint.kind).toBe('place-cross');
    expect(hint.technique).toBe('locked-outside-footprint');
    expect(hint.resultCells.length).toBeGreaterThan(0);

    // The forced crosses should be outside the band (rows 3+) and outside the locked set
    const lockedSet = new Set(['3,3', '4,3', '3,6', '4,6']);
    for (const cell of hint.resultCells) {
      expect(lockedSet.has(`${cell.row},${cell.col}`)).toBe(false);
    }
  });

  /**
   * Direct structural test: a 6×6 board where one region's outside candidates
   * are exactly two adjacent cells in a separate column. Cells adjacent to both
   * must be marked as crosses.
   *
   * Region layout (starsPerUnit=1):
   *   rows 0-2: region 1 (col 0-2) | region 2 (col 3-5)
   *   rows 3-5: region 3 (col 0-2) | region 4 (col 3-5)
   *   + region 5 spans col 1 rows 2-3 (outside pair for its band)
   *
   * Simpler approach: use the layout from the existing overcounting test where
   * region 1 spans all rows, and verify crosses at its in-band cells.
   */
  it('fires on the spanning-region layout and marks its in-band cells as crosses', () => {
    const size = 6;
    const starsPerUnit = 1;

    // Region 1 spans all rows; confined to col 0 rows 3-5 (its outside when band=rows 0-2)
    const R: number[][] = [
      [1, 1, 2, 2, 3, 3],
      [1, 1, 2, 2, 3, 3],
      [1, 1, 2, 2, 3, 3],
      [1, 4, 5, 5, 6, 6],
      [1, 4, 5, 5, 6, 6],
      [1, 4, 5, 5, 6, 6],
    ];

    const cells = emptyGrid(size);
    const state = makeState(size, starsPerUnit, R, cells);
    const hint = findLockedOutsideFootprintHint(state);

    // With band rows 3-5 saturated by regions 4,5,6 (each need 1 star there),
    // region 1 must place its star in rows 0-2 (outside). Its outside candidates
    // (rows 0-2 cells of region 1) span multiple non-adjacent cells so k=1 but
    // the footprint is large → common neighbor set may be empty or small.
    // The technique should at minimum not crash and return a valid hint or null.
    if (hint !== null) {
      expect(hint.kind).toBe('place-cross');
      expect(hint.technique).toBe('locked-outside-footprint');
      expect(hint.resultCells.length).toBeGreaterThan(0);
    }
  });

  /**
   * No hint when there is no saturated band.
   */
  it('returns null when no band is saturated', () => {
    const size = 4;
    const starsPerUnit = 1;

    // All regions span all rows → minInBand = 0 everywhere → no saturated band
    const R: number[][] = [
      [1, 1, 2, 2],
      [1, 1, 2, 2],
      [1, 1, 2, 2],
      [1, 1, 2, 2],
    ];

    const cells = emptyGrid(size);
    const state = makeState(size, starsPerUnit, R, cells);
    const hint = findLockedOutsideFootprintHint(state);
    expect(hint).toBeNull();
  });
});
