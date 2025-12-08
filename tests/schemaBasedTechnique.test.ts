import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findSchemaBasedHint } from '../src/logic/techniques/schemaBased';
import { validateState } from '../src/logic/validation';
import * as schemaRuntime from '../src/logic/schemas/runtime';

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

function createExampleState(): PuzzleState {
  return createEmptyPuzzleState({
    size: 10,
    starsPerUnit: 2,
    regions: EXAMPLE_REGIONS,
  });
}

const findSchemaHintsSpy = vi.spyOn(schemaRuntime, 'findSchemaHints');

const MARKED_PUZZLE = `0x 0x 0x 1s 1x 1x 2s 2x 3x 3x
0x 0s 0x 1x 1x 1x 2x 2x 3s 3x
4x 4x 0x 0s 1x 2s 2x 2x 2x 3x
4s 0x 0x 0x 1x 2x 2x 3x 2x 3s
4x 0x 5x 0x 1s 7x 7s 3x 3x 3x
4x 0x 5s 1x 1x 7x 3x 3x 9s 3x
4s 5x 5x 5x 1x 7s 3x 8x 9x 3x
4x 4x 5s 5x 5x 5x 5x 8s 9x 9x
4x 4x 6x 6x 6s 5x 5x 8x 9x 9s
6x 6s 6x 5x 5x 5x 5x 8s 9x 9x`;

function createStateFromMarkedPuzzle(): PuzzleState {
  const rows = MARKED_PUZZLE.trim().split('\n').map(line => line.trim().split(/\s+/));

  const regions = rows.map(row => row.map(cell => Number(cell.replace(/[xs]/g, '')) || 0));

  const state = createEmptyPuzzleState({
    size: rows.length,
    starsPerUnit: 2,
    regions,
  });

  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell.endsWith('s')) {
        state.cells[r][c] = 'star';
      } else if (cell.endsWith('x')) {
        state.cells[r][c] = 'cross';
      }
    });
  });

  return state;
}

afterEach(() => {
  findSchemaHintsSpy.mockReset();
});

afterAll(() => {
  findSchemaHintsSpy.mockRestore();
});

describe('schema-based technique', () => {
  it('keeps schema crosses from turning into stars on example board', () => {
    const state = createExampleState();
    // Prefill a couple of stars from the documented solution
    state.cells[0][3] = 'star';
    state.cells[1][1] = 'star';

    findSchemaHintsSpy.mockReturnValue({
      id: 'schema-mixed',
      technique: 'schema-based',
      explanation: 'Forces star with accompanying exclusions',
      forcedStars: [
        { row: 0, col: 6 },
      ],
      forcedCrosses: [
        { row: 0, col: 5 },
      ],
      highlights: undefined,
    } as any);

    const hint = findSchemaBasedHint(state);
    expect(hint?.kind).toBe('place-star');
    expect(hint?.resultCells).toEqual([{ row: 0, col: 6 }]);

    for (const cell of hint?.resultCells ?? []) {
      state.cells[cell.row][cell.col] = hint!.kind === 'place-star' ? 'star' : 'cross';
    }

    const errors = validateState(state);
    expect(errors).toHaveLength(0);
  });

  it('still surfaces cross-only deductions from schemas', () => {
    const state = createExampleState();

    findSchemaHintsSpy.mockReturnValue({
      id: 'schema-crosses',
      technique: 'schema-based',
      explanation: 'Only exclusions are available',
      forcedStars: [],
      forcedCrosses: [
        { row: 2, col: 4 },
        { row: 4, col: 6 },
      ],
      highlights: undefined,
    } as any);

    const hint = findSchemaBasedHint(state);
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.resultCells).toEqual([
      { row: 2, col: 4 },
      { row: 4, col: 6 },
    ]);
  });

  it('rejects invalid schema deductions on the user-provided puzzle', () => {
    const state = createStateFromMarkedPuzzle();

    expect(validateState(state)).toHaveLength(0);

    findSchemaHintsSpy.mockReturnValue({
      id: 'schema-invalid-overfill',
      technique: 'schema-based',
      explanation: 'Would overfill the first row with a third star',
      forcedStars: [
        { row: 0, col: 0 },
      ],
      forcedCrosses: [],
      highlights: undefined,
    } as any);

    const hint = findSchemaBasedHint(state);
    expect(hint).toBeNull();
  });

  it('rejects schema hints that conflict with existing placements even when stars are present', () => {
    const state = createExampleState();
    state.cells[0][0] = 'star';

    findSchemaHintsSpy.mockReturnValue({
      id: 'schema-conflicting-cross',
      technique: 'schema-based',
      explanation: 'Cross would invalidate existing star',
      forcedStars: [{ row: 1, col: 1 }],
      forcedCrosses: [{ row: 0, col: 0 }],
      highlights: undefined,
    } as any);

    const hint = findSchemaBasedHint(state);
    expect(hint).toBeNull();
  });
});
