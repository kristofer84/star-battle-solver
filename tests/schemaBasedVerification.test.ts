import { describe, it, expect, vi, afterEach } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findSchemaBasedHint } from '../src/logic/techniques/schemaBased';
import { validateState } from '../src/logic/validation';
import * as search from '../src/logic/search';
import { verifyAndBuildSchemaHint } from '../src/logic/schemas/verification/schemaHintVerifier';
import type { SchemaApplication } from '../src/logic/schemas/types';
import { puzzleStateToBoardState } from '../src/logic/schemas/model/state';
import { enumerateAllCompletions } from '../src/logic/schemas/miner/exactSolver';

const EXAMPLE_REGIONS = [
  [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
  [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
  [4, 4, 0, 0, 1, 2, 2, 2, 2, 3],
  [4, 0, 0, 0, 1, 2, 2, 3, 2, 3],
  [4, 0, 5, 0, 1, 7, 7, 3, 3, 3],
  [4, 0, 5, 1, 1, 7, 3, 3, 9, 3],
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('schema-based verification', () => {
  it('a proved hint is always sound', () => {
    const def = {
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    };

    const solved = search.solvePuzzle(def);
    expect(solved).not.toBeNull();
    if (!solved) return;

    // Make a nearly-complete state: all non-stars are crosses.
    const state: PuzzleState = createEmptyPuzzleState(def);
    for (let r = 0; r < def.size; r += 1) {
      for (let c = 0; c < def.size; c += 1) {
        state.cells[r][c] = solved.cells[r][c] === 'star' ? 'star' : 'cross';
      }
    }

    // Remove exactly one star; it should become forced again.
    let removed: { row: number; col: number } | null = null;
    for (let r = 0; r < def.size && !removed; r += 1) {
      for (let c = 0; c < def.size; c += 1) {
        if (state.cells[r][c] === 'star') {
          state.cells[r][c] = 'empty';
          removed = { row: r, col: c };
          break;
        }
      }
    }
    expect(removed).not.toBeNull();
    if (!removed) return;

    const hint = findSchemaBasedHint(state);
    expect(hint).not.toBeNull();
    if (!hint) return;

    expect(hint.resultCells).toHaveLength(1);
    expect(hint.explanation).toContain('Proof:');

    const { row, col } = hint.resultCells[0];
    expect({ row, col }).toEqual(removed);
    expect(hint.kind).toBe('place-star');

    const nextState: PuzzleState = {
      ...state,
      cells: state.cells.map(r => [...r]),
    };

    nextState.cells[row][col] = hint.kind === 'place-star' ? 'star' : 'cross';

    expect(validateState(nextState)).toEqual([]);

    const sol = search.countSolutions(nextState, { maxCount: 1, timeoutMs: 2000 });
    expect(sol.timedOut).toBe(false);
    expect(sol.count).toBeGreaterThanOrEqual(1);

    // Opposite assumption must yield 0 completions (proved, no timeout/cap)
    const opposite: PuzzleState = {
      ...state,
      cells: state.cells.map(r => [...r]),
    };

    opposite.cells[row][col] = hint.kind === 'place-star' ? 'cross' : 'star';

    const opp = search.countSolutions(opposite, { maxCount: 1, timeoutMs: 2000 });
    expect(opp.timedOut).toBe(false);
    expect(opp.cappedAtMax).toBe(false);
    expect(opp.count).toBe(0);
  });

  it('inconclusive checks do not produce hints', () => {
    const state = createExampleState();

    // Construct a fake schema application with a single candidate.
    // We will force countSolutions to time out so verification cannot prove forcedness.
    const app: SchemaApplication = {
      schemaId: 'test',
      params: {},
      deductions: [{ cell: 0, type: 'forceStar' }],
      explanation: { schemaId: 'test', steps: [] },
    };

    vi.spyOn(search, 'countSolutions').mockReturnValue({
      count: 0,
      timedOut: true,
      cappedAtMax: false,
    });

    const res = verifyAndBuildSchemaHint(
      state,
      app,
      'Base explanation',
      undefined,
      { perCheckTimeoutMs: 1, maxSolutionsToFind: 1 }
    );

    expect(res.kind).toBe('no-verified-deductions');
  });

  it('partial enumeration cannot mark always results in exactSolver', () => {
    const size = 4;
    const regions = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, () => r)
    );
    const state = createEmptyPuzzleState({
      size,
      starsPerUnit: 1,
      regions,
    });
    const boardState = puzzleStateToBoardState(state);

    const analysis = enumerateAllCompletions(boardState, 1, 5000);

    expect(analysis.complete).toBe(false);

    const results = Array.from(analysis.cellResults.values());
    expect(results.length).toBe(size * size);
    expect(results.every(v => v === 'variable')).toBe(true);
  });
});
