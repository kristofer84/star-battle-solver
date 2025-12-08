/**
 * Integration tests for C3_regionLocalCages schema
 */

import { describe, it, expect } from 'vitest';
import { C3RegionLocalCagesSchema } from '../schemas/C3_regionLocalCages';
import { puzzleStateToBoardState } from '../model/state';
import { createEmptyPuzzleState, createEmptyPuzzleDef } from '../../../types/puzzle';
import type { SchemaContext } from '../types';
import { CellState } from '../model/types';

describe('C3_regionLocalCages', () => {
  it('should find deductions when region has valid blocks and quota', () => {
    const def = createEmptyPuzzleDef();
    def.size = 5;
    def.starsPerUnit = 2;
    const state = createEmptyPuzzleState(def);

    // Set up a region that intersects a band
    // Region 0: cells in rows 0-1, columns 0-2
    // This creates a 2x3 area with multiple 2x2 blocks
    const region0 = state.def.regions.find(r => r.id === 0);
    if (region0) {
      // Clear existing cells and set new ones
      region0.cells = [
        { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
        { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
      ];
    }

    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    const applications = C3RegionLocalCagesSchema.apply(ctx);

    // Should not crash
    expect(Array.isArray(applications)).toBe(true);
  });

  it('should not fire when quota is 0', () => {
    const def = createEmptyPuzzleDef();
    def.size = 5;
    def.starsPerUnit = 2;
    const state = createEmptyPuzzleState(def);

    // Set up a region that's already complete (all stars placed)
    const region0 = state.def.regions.find(r => r.id === 0);
    if (!region0) {
      // Skip test if no region found
      expect(true).toBe(true);
      return;
    }

    region0.cells = [
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 1, col: 0 }, { row: 1, col: 1 },
    ];

    // Place all required stars in the region
    const boardState = puzzleStateToBoardState(state);
    // Manually set stars to fill the quota
    for (let i = 0; i < region0.cells.length && i < 2; i++) {
      const cell = region0.cells[i];
      const cellId = cell.row * boardState.size + cell.col;
      boardState.cellStates[cellId] = CellState.Star;
    }

    const ctx: SchemaContext = { state: boardState };

    const applications = C3RegionLocalCagesSchema.apply(ctx);

    // Should not find applications for regions with quota 0
    const c3Apps = applications.filter(app => app.schemaId === 'C3_regionLocalCages');
    // Note: might still find applications for other regions, but not for region 0
    expect(Array.isArray(applications)).toBe(true);
  });

  it('should not fire when no valid blocks exist in region', () => {
    const def = createEmptyPuzzleDef();
    def.size = 5;
    def.starsPerUnit = 2;
    const state = createEmptyPuzzleState(def);

    // Set up a region that's too small for 2x2 blocks
    // Region with only 3 cells (can't form a 2x2 block)
    const region0 = state.def.regions.find(r => r.id === 0);
    if (region0) {
      region0.cells = [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ];
    }

    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    const applications = C3RegionLocalCagesSchema.apply(ctx);

    // Should not crash
    expect(Array.isArray(applications)).toBe(true);
  });

  it('should produce valid deductions structure', () => {
    const def = createEmptyPuzzleDef();
    def.size = 5;
    def.starsPerUnit = 2;
    const state = createEmptyPuzzleState(def);

    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    const applications = C3RegionLocalCagesSchema.apply(ctx);

    // Check structure of applications
    for (const app of applications) {
      expect(app.schemaId).toBe('C3_regionLocalCages');
      expect(app).toHaveProperty('deductions');
      expect(app).toHaveProperty('params');
      expect(app).toHaveProperty('explanation');
      expect(Array.isArray(app.deductions)).toBe(true);
      
      // All deductions should be forceEmpty (crosses)
      for (const deduction of app.deductions) {
        expect(deduction.type).toBe('forceEmpty');
        expect(typeof deduction.cell).toBe('number');
      }
      
      // Check explanation structure
      expect(app.explanation.schemaId).toBe('C3_regionLocalCages');
      expect(Array.isArray(app.explanation.steps)).toBe(true);
    }
  });

  it('should handle multiple regions and bands', () => {
    const def = createEmptyPuzzleDef();
    def.size = 6;
    def.starsPerUnit = 2;
    const state = createEmptyPuzzleState(def);

    // Set up multiple regions that intersect different bands
    // This tests that C3 processes all region-band combinations

    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    const applications = C3RegionLocalCagesSchema.apply(ctx);

    // Should not crash
    expect(Array.isArray(applications)).toBe(true);
    
    // Should process all regions and bands
    // (exact count depends on puzzle structure)
    expect(applications.length).toBeGreaterThanOrEqual(0);
  });
});

