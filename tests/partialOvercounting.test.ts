import { describe, it, expect } from 'vitest';
import { findPartialOvercountingHint } from '../src/logic/techniques/overcounting';
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

describe('Partial Overcounting', () => {
  /**
   * Replicates the exact user scenario:
   *
   * Regions 0-1 are fully confined to rows 0-2 (2 stars each).
   * Regions 2-3 each have exactly one 2x2-adjacent pair outside rows 0-2
   * so they can only pack 1 star outside → must place at least 1 star in rows 0-2.
   * Total min-in-band = 2+2+1+1 = 6 = cap(rows 0-2).
   * → Regions 4 and 5 cells in rows 0-2 must be crosses.
   */
  it('detects partial confinement when outside cells are mutually adjacent', () => {
    // 10x10, 2 stars per unit
    const size = 10;
    const starsPerUnit = 2;

    // Simplified region layout matching the structure described:
    //   region 0: rows 0-1, cols 0-3         (fully confined to rows 0-2)
    //   region 1: rows 0-2, cols 4-9 + (2,9) (fully confined to rows 0-2)
    //   region 2: rows 1-4, cols 0-3         (outside pair: (3,0)+(4,0) — adjacent)
    //   region 3: rows 1-4, cols 4-7         (outside pair: (3,4)+(4,4) — adjacent)
    //   region 4: rows 1-2, cols 7-8         (outside: rows 3+, plenty of room)
    //   region 5: rows 2, col 0              (can easily go outside)
    //   region 6+: fill the rest
    const R = Array.from({ length: size }, () => Array(size).fill(9) as number[]);

    // Region 0: rows 0-1, cols 0-3
    for (let r = 0; r <= 1; r++) for (let c = 0; c <= 3; c++) R[r][c] = 0;
    // Region 1: rows 0-2, cols 4-9
    for (let r = 0; r <= 2; r++) for (let c = 4; c <= 9; c++) R[r][c] = 1;
    // Region 2: rows 1-4, cols 0-3  (outside = rows 3-4, cols 0-3 → pairs are adjacent)
    for (let r = 1; r <= 4; r++) for (let c = 0; c <= 3; c++) R[r][c] = 2;
    // Region 3: rows 1-4, cols 4-7  (outside = rows 3-4, cols 4-7 → pairs adjacent)
    for (let r = 1; r <= 4; r++) for (let c = 4; c <= 7; c++) R[r][c] = 3;
    // Region 4: rows 1-4, cols 8-9  (outside = rows 3-4, cols 8-9 → plenty of room)
    for (let r = 1; r <= 4; r++) for (let c = 8; c <= 9; c++) R[r][c] = 4;
    // Region 5: rows 5-9, cols 0-4
    for (let r = 5; r <= 9; r++) for (let c = 0; c <= 4; c++) R[r][c] = 5;
    // Region 6: rows 5-9, cols 5-9
    for (let r = 5; r <= 9; r++) for (let c = 5; c <= 9; c++) R[r][c] = 6;

    const cells = emptyGrid(size);

    const state = makeState(size, starsPerUnit, R, cells);
    const hint = findPartialOvercountingHint(state);

    // The technique should fire and produce crosses somewhere in rows 0-2
    // (specifically cells belonging to region 4 or 5 that are in rows 0-2)
    expect(hint).not.toBeNull();
    if (!hint) return;

    expect(hint.kind).toBe('place-cross');
    expect(hint.technique).toBe('partial-overcounting');
    expect(hint.resultCells.length).toBeGreaterThan(0);

    // All forced crosses must be empty cells in rows 0-2
    for (const cell of hint.resultCells) {
      expect(cell.row).toBeLessThanOrEqual(2);
    }
  });

  /**
   * Classic full-confinement case: region 1 spans all 6 rows but can escape the
   * lower band (rows 3-5) via its upper-band cells. Regions 4-6 are fully confined
   * to rows 3-5, saturating that band's budget so region 1 is forced out.
   *
   * Layout (starsPerUnit=1):
   *   row 0-2: [1,1, 2,2, 3,3]
   *   row 3-5: [1,4, 5,5, 6,6]
   * Region 1 spans all rows (col 0 rows 0-5, col 1 rows 0-2 only).
   */
  it('handles the classic full-confinement case', () => {
    const size = 6;
    const starsPerUnit = 1;

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
    const hint = findPartialOvercountingHint(state);

    // Should find forced crosses (region 1 cells in rows 3-5 must be crosses
    // because regions 4-6 already saturate the band budget)
    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.technique).toBe('partial-overcounting');
    expect(hint?.resultCells.length).toBeGreaterThan(0);
  });

  /**
   * No hint when adjacent outside cells give each partially-confined region
   * enough room to escape the band with no budget overflow.
   */
  it('returns null when band budget is not saturated', () => {
    const size = 6;
    const starsPerUnit = 1;

    // All regions span all 6 rows → minInBand = 0 for every region → totalMin = 0 ≠ cap
    const R: number[][] = [
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
      [1, 1, 1, 2, 2, 2],
    ];

    const cells = emptyGrid(size);
    const state = makeState(size, starsPerUnit, R, cells);
    const hint = findPartialOvercountingHint(state);

    expect(hint).toBeNull();
  });
});
