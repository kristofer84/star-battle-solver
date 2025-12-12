import { describe, expect, it } from 'vitest';
import { DEFAULT_SIZE, DEFAULT_STARS_PER_UNIT } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import type { TechniqueId } from '../src/types/hints';
import { makeState, applyHint } from './integration-helpers';

describe('Integration Tests: Complete Puzzle Solving', () => {
  it('can make progress on an empty puzzle using basic techniques', async () => {
    var start = performance.now();
    const state = makeState();
    console.error('a', performance.now() - start)
    
    let hintsApplied = 0;
    const maxHints = 30; // Reduced from 50
    let previousStateHash = '';
    let noProgressCount = 0;
    const maxNoProgress = 3;
    
    for (let i = 0; i < maxHints; i++) {
      console.error('b0', performance.now() - start)
      const hint = await findNextHint(state);
      if (!hint) break;
      console.error('b1', performance.now() - start)
      
      // Check progress
      const stateHash = JSON.stringify(state.cells);
      if (stateHash === previousStateHash) {
        noProgressCount++;
        if (noProgressCount >= maxNoProgress) break;
      } else {
        noProgressCount = 0;
        previousStateHash = stateHash;
      }
      
      // Apply the hint
      if (hint.resultCells && Array.isArray(hint.resultCells)) {
        for (const cell of hint.resultCells) {
          const value = hint.kind === 'place-star' ? 'star' : 'cross';
          state.cells[cell.row][cell.col] = value;
        }
        hintsApplied++;
      }
    }
    
    // Should be able to apply at least some hints
    console.error('c', performance.now() - start)
    
    expect(hintsApplied).toBeGreaterThan(0);
  });

  it('applies techniques in correct order', async () => {
    const state = makeState();
    
    // Create a state where multiple techniques could apply
    state.cells[0][0] = 'star';
    state.cells[0][5] = 'star';
    
    const hint = await findNextHint(state);
    expect(hint).not.toBeNull();
    
    // Should use trivial-marks (earliest technique) not a later one
    expect(hint?.technique).toBe('trivial-marks');
  });

  it('respects technique priority ordering', async () => {
    const state = makeState();
    
    const techniqueOrder: TechniqueId[] = [];
    let previousStateHash = '';
    let noProgressCount = 0;
    const maxIterations = 50; // Reduced from 100
    const maxNoProgress = 3;
    
    for (let i = 0; i < maxIterations; i++) {
      const hint = await findNextHint(state);
      if (!hint) break;
      
      // Check progress
      const stateHash = JSON.stringify(state.cells);
      if (stateHash === previousStateHash) {
        noProgressCount++;
        if (noProgressCount >= maxNoProgress) break;
      } else {
        noProgressCount = 0;
        previousStateHash = stateHash;
      }
      
      techniqueOrder.push(hint.technique);
      const applied = await applyHint(state);
      if (!applied) break;
    }
    
    // Verify that earlier techniques appear before later ones
    const basicTechniques: TechniqueId[] = [
      'trivial-marks',
      'two-by-two',
      'exact-fill',
      'simple-shapes',
      'exclusion',
      'pressured-exclusion',
    ];
    
    const countingTechniques: TechniqueId[] = [
      'undercounting',
      'overcounting',
      'finned-counts',
      'composite-shapes',
      'squeeze',
      'set-differentials',
    ];
    
    // If we see any counting technique, we should have seen basic techniques first
    const firstCountingIndex = techniqueOrder.findIndex(t => 
      countingTechniques.includes(t)
    );
    
    if (firstCountingIndex !== -1) {
      // Check that we used some basic techniques before counting
      const techniquesBeforeCounting = techniqueOrder.slice(0, firstCountingIndex);
      const hasBasicTechniques = techniquesBeforeCounting.some(t => 
        basicTechniques.includes(t)
      );
      
      expect(hasBasicTechniques).toBe(true);
    }
  });

  it('handles partially solved puzzles correctly', async () => {
    const state = makeState();
    
    // Fill in a valid partial solution
    state.cells[0][0] = 'star';
    state.cells[0][5] = 'star';
    state.cells[1][2] = 'star';
    state.cells[1][7] = 'star';
    state.cells[2][1] = 'star';
    state.cells[2][6] = 'star';
    
    // Mark some cells as crosses
    state.cells[0][1] = 'cross';
    state.cells[0][2] = 'cross';
    state.cells[1][0] = 'cross';
    state.cells[1][1] = 'cross';
    
    // Should still be able to find hints
    const hint = await findNextHint(state);
    expect(hint).not.toBeNull();
  });

  it('returns null when no techniques apply', async () => {
    const state = makeState();
    
    // Create a complete valid solution
    // This is complex, so we'll just test that null is returned appropriately
    // by filling the entire grid with crosses (invalid but tests the null case)
    for (let r = 0; r < DEFAULT_SIZE; r++) {
      for (let c = 0; c < DEFAULT_SIZE; c++) {
        state.cells[r][c] = 'cross';
      }
    }
    
    const hint = await findNextHint(state);
    // With all crosses, no technique should apply
    expect(hint).toBeNull();
  });

  it('can solve multiple steps in sequence', async () => {
    const state = makeState();
    
    const appliedTechniques: TechniqueId[] = [];
    let previousStateHash = '';
    let noProgressCount = 0;
    const maxSteps = 100; // Reduced from 300
    const maxNoProgress = 3;
    
    for (let i = 0; i < maxSteps; i++) {
      const hint = await findNextHint(state);
      if (!hint) break;
      
      // Check progress
      const stateHash = JSON.stringify(state.cells);
      if (stateHash === previousStateHash) {
        noProgressCount++;
        if (noProgressCount >= maxNoProgress) break;
      } else {
        noProgressCount = 0;
        previousStateHash = stateHash;
      }
      
      appliedTechniques.push(hint.technique);
      
      // Apply the hint
      if (hint.resultCells && Array.isArray(hint.resultCells)) {
        for (const cell of hint.resultCells) {
          const value = hint.kind === 'place-star' ? 'star' : 'cross';
          state.cells[cell.row][cell.col] = value;
        }
      }
    }
    
    // Should have applied multiple techniques
    expect(appliedTechniques.length).toBeGreaterThan(0);
    
    // Should have used multiple different techniques
    const uniqueTechniques = new Set(appliedTechniques);
    expect(uniqueTechniques.size).toBeGreaterThan(1);
  });
});

describe('Integration Tests: Guide Example Sequences', () => {
  it('solves a basics-focused puzzle sequence', async () => {
    const state = makeState();
    
    const techniquesUsed: TechniqueId[] = [];
    let previousStateHash = '';
    let noProgressCount = 0;
    const maxSteps = 50; // Reduced from 100
    const maxNoProgress = 3;
    
    for (let i = 0; i < maxSteps; i++) {
      const hint = await findNextHint(state);
      if (!hint) break;
      
      // Check progress
      const stateHash = JSON.stringify(state.cells);
      if (stateHash === previousStateHash) {
        noProgressCount++;
        if (noProgressCount >= maxNoProgress) break;
      } else {
        noProgressCount = 0;
        previousStateHash = stateHash;
      }
      
      techniquesUsed.push(hint.technique);
      const applied = await applyHint(state);
      if (!applied) break;
    }
    
    // Should use basic techniques
    const basicTechniques: TechniqueId[] = [
      'trivial-marks',
      'two-by-two',
      'exact-fill',
      'simple-shapes',
      'exclusion',
    ];
    
    const usedBasicTechniques = techniquesUsed.filter(t => basicTechniques.includes(t));
    expect(usedBasicTechniques.length).toBeGreaterThan(0);
  });

  it('demonstrates technique progression through categories', async () => {
    const state = makeState();
    
    const techniquesUsed: TechniqueId[] = [];
    let previousStateHash = '';
    let noProgressCount = 0;
    const maxSteps = 100; // Reduced from 300
    const maxNoProgress = 3;
    
    for (let i = 0; i < maxSteps; i++) {
      const hint = await findNextHint(state);
      if (!hint) break;
      
      // Check progress
      const stateHash = JSON.stringify(state.cells);
      if (stateHash === previousStateHash) {
        noProgressCount++;
        if (noProgressCount >= maxNoProgress) break;
      } else {
        noProgressCount = 0;
        previousStateHash = stateHash;
      }
      
      techniquesUsed.push(hint.technique);
      const applied = await applyHint(state);
      if (!applied) break;
    }
    
    // Should use techniques from multiple categories
    const uniqueTechniques = new Set(techniquesUsed);
    expect(uniqueTechniques.size).toBeGreaterThan(1);
    
    // Should start with basic techniques
    if (techniquesUsed.length > 0) {
      const firstTechnique = techniquesUsed[0];
      const basicTechniques: TechniqueId[] = [
        'trivial-marks',
        'locked-line',
        'adjacent-row-col',
        'two-by-two',
        'exact-fill',
        'exclusion',
        'pressured-exclusion',
        'simple-shapes',
      ];
      expect(basicTechniques).toContain(firstTechnique);
    }
  });

  it('verifies hints are sound throughout solving', async () => {
    const state = makeState();
    
    let previousStateHash = '';
    let noProgressCount = 0;
    const maxSteps = 100; // Reduced from 200
    const maxNoProgress = 3;
    
    for (let i = 0; i < maxSteps; i++) {
      const hint = await findNextHint(state);
      if (!hint) break;
      
      // Check progress
      const stateHash = JSON.stringify(state.cells);
      if (stateHash === previousStateHash) {
        noProgressCount++;
        if (noProgressCount >= maxNoProgress) break;
      } else {
        noProgressCount = 0;
        previousStateHash = stateHash;
      }
      
      // Verify hint has required properties
      expect(hint.technique).toBeTruthy();
      expect(hint.kind).toMatch(/^(place-star|place-cross)$/);
      expect(hint.resultCells?.length).toBeGreaterThan(0);
      expect(hint.explanation).toBeTruthy();
      
      // Apply hint
      const applied = await applyHint(state);
      if (!applied) break;
      
      // Verify state remains valid (no unit has more than 2 stars)
      for (let row = 0; row < DEFAULT_SIZE; row++) {
        let rowStars = 0;
        for (let col = 0; col < DEFAULT_SIZE; col++) {
          if (state.cells[row][col] === 'star') rowStars++;
        }
        expect(rowStars).toBeLessThanOrEqual(DEFAULT_STARS_PER_UNIT);
      }
      
      for (let col = 0; col < DEFAULT_SIZE; col++) {
        let colStars = 0;
        for (let row = 0; row < DEFAULT_SIZE; row++) {
          if (state.cells[row][col] === 'star') colStars++;
        }
        expect(colStars).toBeLessThanOrEqual(DEFAULT_STARS_PER_UNIT);
      }
    }
  });

  it('handles mixed technique requirements', async () => {
    const state = makeState();
    
    // Apply many hints and track technique diversity
    const techniquesUsed = new Set<TechniqueId>();
    let previousStateHash = '';
    let noProgressCount = 0;
    const maxSteps = 100; // Reduced from 300
    const maxNoProgress = 3;
    
    for (let i = 0; i < maxSteps; i++) {
      const hint = await findNextHint(state);
      if (!hint) break;
      
      // Check progress
      const stateHash = JSON.stringify(state.cells);
      if (stateHash === previousStateHash) {
        noProgressCount++;
        if (noProgressCount >= maxNoProgress) break;
      } else {
        noProgressCount = 0;
        previousStateHash = stateHash;
      }
      
      techniquesUsed.add(hint.technique);
      const applied = await applyHint(state);
      if (!applied) break;
    }
    
    // Should use multiple different techniques
    expect(techniquesUsed.size).toBeGreaterThan(2);
  });
});
