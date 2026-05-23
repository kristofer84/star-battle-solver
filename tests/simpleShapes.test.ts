import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIZE,
  DEFAULT_STARS_PER_UNIT,
  type PuzzleDef,
  createEmptyPuzzleState,
} from '../src/types/puzzle';
import { findSimpleShapesHint } from '../src/logic/techniques/simpleShapes';

function makeHorizontalStripDef(): PuzzleDef {
  const regions: number[][] = [];
  for (let r = 0; r < DEFAULT_SIZE; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < DEFAULT_SIZE; c += 1) {
      row.push(1);
    }
    regions.push(row);
  }
  // Make region 1 a horizontal 1×4 at row 4, columns 3..6
  for (let r = 0; r < DEFAULT_SIZE; r += 1) {
    for (let c = 0; c < DEFAULT_SIZE; c += 1) {
      regions[r][c] = 2; // default region
    }
  }
  const stripRow = 4;
  for (let c = 3; c <= 6; c += 1) {
    regions[stripRow][c] = 1;
  }

  return {
    size: DEFAULT_SIZE,
    starsPerUnit: DEFAULT_STARS_PER_UNIT,
    regions,
  };
}

describe('simple-shapes technique – 1×4 / 4×1 regions', () => {
  it('marks outside cells for a horizontal 1×4 region as crosses', () => {
    const def = makeHorizontalStripDef();
    const state = createEmptyPuzzleState(def);

    const hint = findSimpleShapesHint(state);
    expect(hint).not.toBeNull();
    if (!hint) return;

    expect(hint.kind).toBe('place-cross');

    const stripRow = 4;
    const inStripCols = new Set([3, 4, 5, 6]);

    // Every suggested cross in the stripRow must be outside the 1×4.
    for (const c of hint.resultCells) {
      if (c.row === stripRow) {
        expect(inStripCols.has(c.col)).toBe(false);
      }
    }

    // The 1×4 cells themselves should not be in resultCells.
    for (let c = 3; c <= 6; c += 1) {
      expect(
        hint.resultCells.some((rc) => rc.row === stripRow && rc.col === c),
      ).toBe(false);
    }
  });
});

describe('simple-shapes technique – 5-cell P-pentomino forced-cross bug', () => {
  /**
   * Regression test for the false deduction in a 5-cell region.
   *
   * Region G (id=7) is a P-pentomino:
   *   (3,6), (4,6), (4,7), (5,7), (5,8)
   *
   * (4,6) and (4,7) are already marked as crosses.
   *
   * The 2×2 block at rows 4–5, cols 6–7 contains 3 shape cells:
   *   {(4,6), (4,7), (5,7)}.
   * The 4th cell (5,6) is NOT in the region.
   *
   * The old code incorrectly forced (5,6) as a cross, but a valid star
   * placement exists: stars at (3,6) and (5,8), neither in the 2×2 block.
   */
  function makePPentominoDef(): PuzzleDef {
    // Fill everything with region 1 (background), then carve out region 7.
    const regions: number[][] = Array.from({ length: DEFAULT_SIZE }, () =>
      Array(DEFAULT_SIZE).fill(1),
    );
    // Region 7: P-pentomino cells
    regions[3][6] = 7;
    regions[4][6] = 7;
    regions[4][7] = 7;
    regions[5][7] = 7;
    regions[5][8] = 7;
    return { size: DEFAULT_SIZE, starsPerUnit: DEFAULT_STARS_PER_UNIT, regions };
  }

  it('should NOT mark (5,6) as a forced cross for the 5-cell P-pentomino region', () => {
    const def = makePPentominoDef();
    const state = createEmptyPuzzleState(def);

    // Pre-mark (4,6) and (4,7) as crosses, matching the bug scenario.
    state.cells[4][6] = 'cross';
    state.cells[4][7] = 'cross';

    // Collect all hints until no more are available, accumulating forced crosses.
    // We want to ensure (5,6) is never suggested as a forced cross for region 7.
    let hint = findSimpleShapesHint(state);
    let iterations = 0;
    while (hint !== null && iterations < 20) {
      if (hint.kind === 'place-cross') {
        expect(
          hint.resultCells.some((rc) => rc.row === 5 && rc.col === 6),
          `simple-shapes incorrectly forced (5,6) as a cross (hint: ${hint.explanation})`,
        ).toBe(false);

        // Apply the crosses so we can advance to the next hint.
        for (const rc of hint.resultCells) {
          state.cells[rc.row][rc.col] = 'cross';
        }
      } else if (hint.kind === 'place-star') {
        for (const rc of hint.resultCells) {
          state.cells[rc.row][rc.col] = 'star';
        }
      }

      hint = findSimpleShapesHint(state);
      iterations += 1;
    }
  });

  it('valid star placement (3,6) and (5,8) is consistent with no forced cross at (5,6)', () => {
    const def = makePPentominoDef();
    const state = createEmptyPuzzleState(def);

    // Pre-mark crosses.
    state.cells[4][6] = 'cross';
    state.cells[4][7] = 'cross';

    // Place stars at the counterexample positions.
    state.cells[3][6] = 'star';
    state.cells[5][8] = 'star';

    // (5,6) should remain empty — the hint system must not suggest it as a cross.
    const hint = findSimpleShapesHint(state);
    if (hint && hint.kind === 'place-cross') {
      expect(
        hint.resultCells.some((rc) => rc.row === 5 && rc.col === 6),
        `simple-shapes incorrectly forced (5,6) as a cross after valid star placement`,
      ).toBe(false);
    }
  });
});


