import { describe, expect, it } from 'vitest';
import { computeStats } from '../src/logic/stats';
import { createEmptyPuzzleState, type PuzzleDef, type PuzzleState } from '../src/types/puzzle';
import { findSubsetConstraintSqueezeHint } from '../src/logic/techniques/subsetConstraintSqueeze';

function makeSmallState(): PuzzleState {
  const def: PuzzleDef = {
    size: 2,
    starsPerUnit: 1,
    regions: [
      [1, 1],
      [2, 2],
    ],
  };
  return createEmptyPuzzleState(def);
}

function makeForcedBandState(): PuzzleState {
  const def: PuzzleDef = {
    size: 4,
    starsPerUnit: 1,
    regions: [
      [1, 1, 2, 2],
      [1, 1, 2, 2],
      [1, 1, 3, 3],
      [4, 4, 3, 3],
    ],
  };
  const state = createEmptyPuzzleState(def);

  // Fill row 2 elsewhere so cells (2,0) and (2,1) are no longer legal star placements.
  state.cells[2][3] = 'star';

  return state;
}

describe('stats layer', () => {
  it('computes row/col/region constraints with remaining quotas', () => {
    const state = makeSmallState();
    const stats = computeStats(state);

    expect(stats.rowConstraints).toHaveLength(2);
    expect(stats.colConstraints).toHaveLength(2);
    expect(stats.regionConstraints).toHaveLength(2);

    expect(stats.rowConstraints[0].minStars).toBe(1);
    expect(stats.rowConstraints[0].maxStars).toBe(1);
    expect(stats.colConstraints[1].minStars).toBe(1);
    expect(stats.regionConstraints[0].minStars).toBe(1);
  });
});

describe('subset constraint squeeze', () => {
  it('eliminates cells outside a fully-accounted constraint subset', () => {
    const state = makeSmallState();

    // Block the bottom-left cell so the first column can only place a star in (0,0)
    state.cells[1][0] = 'cross';

    const hint = findSubsetConstraintSqueezeHint(state);

    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.resultCells).toEqual([{ row: 0, col: 1 }]);
    expect(hint?.explanation).toContain('Subset constraint squeeze');
  });

  it('combines a forced 2×2 block with a region band constraint', () => {
    const state = makeForcedBandState();
    const hint = findSubsetConstraintSqueezeHint(state);

    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.resultCells).toHaveLength(2);
    expect(hint?.resultCells).toEqual(
      expect.arrayContaining([
        { row: 2, col: 0 },
        { row: 2, col: 1 },
      ]),
    );
  });
});

