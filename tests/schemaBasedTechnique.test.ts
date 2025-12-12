import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findSchemaBasedHint } from '../src/logic/techniques/schemaBased';
import * as schemaRuntime from '../src/logic/schemas/runtime';
import * as verifier from '../src/logic/schemas/verification/schemaHintVerifier';
import type { SchemaApplication } from '../src/logic/schemas/types';

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

const findBestSpy = vi.spyOn(schemaRuntime, 'findBestSchemaApplication');
const verifySpy = vi.spyOn(verifier, 'verifyAndBuildSchemaHint');

afterEach(() => {
  findBestSpy.mockReset();
  verifySpy.mockReset();
});

afterAll(() => {
  findBestSpy.mockRestore();
  verifySpy.mockRestore();
});

describe('schema-based technique (verified, single-cell)', () => {
  it('returns a single-cell verified hint', () => {
    const state = createExampleState();

    const app: SchemaApplication = {
      schemaId: 'test',
      params: {},
      deductions: [{ cell: 0, type: 'forceStar' }],
      explanation: { schemaId: 'test', steps: [] },
    };

    findBestSpy.mockReturnValue({
      app,
      baseExplanation: 'Base explanation',
      baseHighlights: undefined,
    });

    verifySpy.mockReturnValue({
      kind: 'verified-hint',
      hint: {
        id: 'verified',
        kind: 'place-star',
        technique: 'schema-based',
        resultCells: [{ row: 0, col: 0 }],
        explanation: 'Base\n\nProof:\n...',
        highlights: undefined,
      },
    });

    const hint = findSchemaBasedHint(state);
    expect(hint).not.toBeNull();
    expect(hint?.resultCells).toHaveLength(1);
    expect(hint?.schemaCellTypes).toBeUndefined();
  });

  it('returns null when no deduction is verified', () => {
    const state = createExampleState();

    const app: SchemaApplication = {
      schemaId: 'test',
      params: {},
      deductions: [{ cell: 0, type: 'forceStar' }],
      explanation: { schemaId: 'test', steps: [] },
    };

    findBestSpy.mockReturnValue({
      app,
      baseExplanation: 'Base explanation',
      baseHighlights: undefined,
    });

    verifySpy.mockReturnValue({ kind: 'no-verified-deductions' });

    expect(findSchemaBasedHint(state)).toBeNull();
  });

  it('keeps validateState as a final guard', () => {
    const state = createExampleState();

    // Row 0 already has 2 stars.
    state.cells[0][1] = 'star';
    state.cells[0][4] = 'star';

    const app: SchemaApplication = {
      schemaId: 'test',
      params: {},
      deductions: [{ cell: 0, type: 'forceStar' }],
      explanation: { schemaId: 'test', steps: [] },
    };

    findBestSpy.mockReturnValue({
      app,
      baseExplanation: 'Base explanation',
      baseHighlights: undefined,
    });

    // Verifier claims (0,0) is a star, but that would overfill row 0.
    verifySpy.mockReturnValue({
      kind: 'verified-hint',
      hint: {
        id: 'verified',
        kind: 'place-star',
        technique: 'schema-based',
        resultCells: [{ row: 0, col: 0 }],
        explanation: 'Base\n\nProof:\n...',
        highlights: undefined,
      },
    });

    expect(findSchemaBasedHint(state)).toBeNull();
  });
});
