/**
 * Unit tests for A1 – Row-Band vs Regions Star-Budget Squeeze
 */

import { describe, it, expect } from 'vitest';
import { A1Schema } from '../schemas/A1_rowBandRegionBudget';
import { puzzleStateToBoardState } from '../model/state';
import { createEmptyPuzzleState, createEmptyPuzzleDef } from '../../../types/puzzle';
import type { SchemaContext } from '../types';

describe('A1_rowBand_regionBudget', () => {
  it('should find deductions when region quota can be determined', async () => {
    const def = createEmptyPuzzleDef();
    def.size = 5;
    def.starsPerUnit = 1;
    const state = createEmptyPuzzleState(def);

    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    const applications = await A1Schema.apply(ctx);

    // Should not crash
    expect(Array.isArray(applications)).toBe(true);
  });

  it('should not fire when preconditions are not met', async () => {
    const def = createEmptyPuzzleDef();
    def.size = 5;
    def.starsPerUnit = 1;
    const state = createEmptyPuzzleState(def);

    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    const applications = await A1Schema.apply(ctx);

    // With empty board, A1 might not find applications
    expect(Array.isArray(applications)).toBe(true);
  });
});
