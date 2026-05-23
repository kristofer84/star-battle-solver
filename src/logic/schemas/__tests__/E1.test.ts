/**
 * Unit tests for E1 – Candidate Deficit schema
 */

import { describe, it, expect } from 'vitest';
import { E1Schema } from '../schemas/E1_candidateDeficit';
import { puzzleStateToBoardState } from '../model/state';
import { createEmptyPuzzleState, createEmptyPuzzleDef } from '../../../types/puzzle';
import type { SchemaContext } from '../types';

describe('E1_candidateDeficit', () => {
  it('should find forced stars when candidates equal remaining stars', async () => {
    const def = createEmptyPuzzleDef();
    def.size = 5;
    def.starsPerUnit = 1;
    const state = createEmptyPuzzleState(def);

    // Set up a row with 1 star needed and exactly 1 candidate
    // Row 0: place crosses everywhere except one cell
    for (let c = 0; c < 5; c++) {
      if (c !== 2) {
        state.cells[0][c] = 'cross';
      }
    }

    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    const applications = await E1Schema.apply(ctx);

    expect(applications.length).toBeGreaterThan(0);
    const app = applications.find(a => a.schemaId === 'E1_candidateDeficit');
    expect(app).toBeDefined();
    if (app) {
      expect(app.deductions.length).toBe(1);
      expect(app.deductions[0].type).toBe('forceStar');
      // Cell at row 0, col 2 should be forced star
      const cellId = 0 * 5 + 2;
      expect(app.deductions[0].cell).toBe(cellId);
    }
  });

  it('should not fire when candidates exceed remaining stars', async () => {
    const def = createEmptyPuzzleDef();
    def.size = 5;
    def.starsPerUnit = 1;
    const state = createEmptyPuzzleState(def);

    // Row 0: leave 2 candidates (but only 1 star needed)
    for (let c = 0; c < 5; c++) {
      if (c > 2) {
        state.cells[0][c] = 'cross';
      }
    }

    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    const applications = await E1Schema.apply(ctx);

    // Should not find E1 application (candidates > required)
    const e1Apps = applications.filter(a => a.schemaId === 'E1_candidateDeficit');
    expect(e1Apps.length).toBe(0);
  });

  it('should handle regions as well as rows/columns', async () => {
    const def = createEmptyPuzzleDef();
    def.size = 5;
    def.starsPerUnit = 1;
    const state = createEmptyPuzzleState(def);

    // Set up region 1 with 1 star needed and exactly 1 candidate
    // This is a simplified test - full test would set up proper region structure
    // For now, just verify the schema runs without errors
    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    const applications = await E1Schema.apply(ctx);

    // Should not crash
    expect(Array.isArray(applications)).toBe(true);
  });
});
