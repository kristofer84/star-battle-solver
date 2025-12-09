import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findNextHint, techniquesInOrder } from '../src/logic/techniques';
import * as mainSolver from '../src/logic/mainSolver';
import type { Technique } from '../src/logic/techniques';
import { createEmptyPuzzleDef, createEmptyPuzzleState } from '../src/types/puzzle';
import type { Deduction } from '../src/types/deductions';

const originalTechniques = [...techniquesInOrder];

const testTechnique: Technique = {
  id: 'trivial-marks',
  name: 'Test Technique',
  findHint: () => ({
    id: 'test-hint',
    kind: 'place-star',
    technique: 'trivial-marks',
    resultCells: [{ row: 0, col: 0 }],
    explanation: 'Direct hint should be returned',
  }),
  findResult: () => {
    const deductions: Deduction[] = [
      {
        kind: 'cell',
        cell: { row: 0, col: 1 },
        type: 'forceEmpty',
        technique: 'trivial-marks',
      },
    ];

    return {
      type: 'hint',
      hint: {
        id: 'test-hint',
        kind: 'place-star',
        technique: 'trivial-marks',
        resultCells: [{ row: 0, col: 0 }],
        explanation: 'Direct hint should be returned',
      },
      deductions,
    };
  },
};

beforeEach(() => {
  techniquesInOrder.unshift(testTechnique);
});

afterEach(() => {
  techniquesInOrder.splice(0, techniquesInOrder.length, ...originalTechniques);
  vi.restoreAllMocks();
});

describe('findNextHint', () => {
  it('returns the direct technique hint without aggregating with the main solver', async () => {
    const analyzeSpy = vi.spyOn(mainSolver, 'analyzeDeductions');
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());

    const hint = await findNextHint(state);

    expect(hint?.id).toBe('test-hint');
    expect(analyzeSpy).not.toHaveBeenCalled();
  });
});
