import { describe, expect, it } from 'vitest';
import { DEFAULT_SIZE, DEFAULT_STARS_PER_UNIT, type PuzzleDef, createEmptyPuzzleState } from '../src/types/puzzle';
import { validateRegions } from '../src/logic/validation';
import { TEST_REGIONS } from './testBoard';

describe('test board regions', () => {
  it('have valid region ids 0-9 and cover all cells', () => {
    const def: PuzzleDef = {
      size: DEFAULT_SIZE,
      starsPerUnit: DEFAULT_STARS_PER_UNIT,
      regions: TEST_REGIONS,
    };
    const issues = validateRegions(def);
    expect(issues).toEqual([]);
  });

  it('can be used to create a puzzle state without errors', () => {
    const def: PuzzleDef = {
      size: DEFAULT_SIZE,
      starsPerUnit: DEFAULT_STARS_PER_UNIT,
      regions: TEST_REGIONS,
    };
    const state = createEmptyPuzzleState(def);
    expect(state.cells.length).toBe(10);
    expect(state.cells[0].length).toBe(10);
  });
});


