import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createEmptyPuzzleDef, createEmptyPuzzleState } from '../src/types/puzzle';
import type { PuzzleState, CellState, Coords } from '../src/types/puzzle';
import { findNextHint, techniquesInOrder } from '../src/logic/techniques';

/**
 * **Feature: star-battle-techniques, Property 22: Technique ordering is respected**
 * **Validates: Requirements 23.1, 23.2**
 * 
 * For any puzzle state where multiple techniques could provide hints,
 * findNextHint should return the hint from the earliest technique in the ordering.
 */

describe('Technique Priority Property Tests', () => {
  // Generator for valid cell coordinates
  const coordsArb = fc.record({
    row: fc.integer({ min: 0, max: 9 }),
    col: fc.integer({ min: 0, max: 9 }),
  });

  // Generator for a list of unique coordinates
  const uniqueCoordsArb = fc
    .uniqueArray(coordsArb, {
      minLength: 0,
      maxLength: 20,
      selector: (c) => `${c.row},${c.col}`,
    });

  // Generator for puzzle states with random star/cross placements
  const puzzleStateArb = fc.record({
    stars: uniqueCoordsArb,
    crosses: uniqueCoordsArb,
  }).map(({ stars, crosses }) => {
    const def = createEmptyPuzzleDef();
    const state = createEmptyPuzzleState(def);
    
    // Place stars
    for (const coord of stars) {
      state.cells[coord.row][coord.col] = 'star';
    }
    
    // Place crosses (only if not already a star)
    for (const coord of crosses) {
      if (state.cells[coord.row][coord.col] === 'empty') {
        state.cells[coord.row][coord.col] = 'cross';
      }
    }
    
    return state;
  });

  it('should return hint from earliest applicable technique', async () => {
    await fc.assert(
      fc.asyncProperty(puzzleStateArb, async (state) => {
        const hint = await findNextHint(state);

        if (hint === null) {
          return true;
        }

        const hintTechniqueIndex = techniquesInOrder.findIndex(
          t => t.id === hint.technique
        );

        for (let i = 0; i < hintTechniqueIndex; i++) {
          const earlierHint = techniquesInOrder[i].findHint(state);
          const resolved = earlierHint instanceof Promise ? await earlierHint : earlierHint;
          if (resolved !== null) {
            return false;
          }
        }

        return true;
      }),
      { numRuns: 3, timeout: 30000 }
    );
  });

  it('should consistently return the same technique for the same state', async () => {
    await fc.assert(
      fc.asyncProperty(puzzleStateArb, async (state) => {
        const hint1 = await findNextHint(state);
        const hint2 = await findNextHint(state);

        if (hint1 === null && hint2 === null) {
          return true;
        }

        if (hint1 === null || hint2 === null) {
          return false;
        }

        return hint1.technique === hint2.technique;
      }),
      { numRuns: 3, timeout: 30000 }
    );
  });

  it('should return hints with valid technique IDs', async () => {
    await fc.assert(
      fc.asyncProperty(puzzleStateArb, async (state) => {
        const hint = await findNextHint(state);

        if (hint === null) {
          return true;
        }

        const techniqueExists = techniquesInOrder.some(
          t => t.id === hint.technique
        );

        return techniqueExists;
      }),
      { numRuns: 3, timeout: 30000 }
    );
  });

  it('should respect ordering when multiple basic techniques apply', async () => {
    const def = createEmptyPuzzleDef();
    const state = createEmptyPuzzleState(def);

    state.cells[0][0] = 'star';
    state.cells[0][1] = 'star';
    state.cells[5][5] = 'star';

    const hint = await findNextHint(state);

    expect(hint).not.toBeNull();
    expect(hint?.technique).toBe('trivial-marks');
  });

  it('should handle empty puzzle state without throwing', async () => {
    // Solver must not crash on an all-empty valid board.
    // Note: techniques CAN fire on an empty board (board structure alone implies constraints),
    // so we only verify no exception is thrown and the return type is correct.
    const regions = [
      [1,1,1,2,2,2,3,3,4,4],
      [1,1,1,2,2,2,3,3,4,4],
      [1,1,1,2,2,3,3,3,4,4],
      [5,5,6,6,2,3,7,7,4,4],
      [5,5,6,6,6,6,7,7,8,8],
      [5,5,6,6,6,6,7,7,8,8],
      [5,5,9,9,9,6,7,8,8,8],
      [5,5,9,9,9,9,10,8,8,8],
      [5,5,9,9,9,9,10,10,10,10],
      [5,5,9,9,9,9,10,10,10,10],
    ];
    const state = createEmptyPuzzleState({ size: 10, starsPerUnit: 2, regions });

    const hint = await findNextHint(state);

    // hint is either null (no deductions) or a valid Hint object — both are acceptable
    expect(hint === null || typeof hint === 'object').toBe(true);
    if (hint !== null) {
      expect(hint.technique).toBeDefined();
      expect(hint.resultCells).toBeDefined();
    }
  });
});
