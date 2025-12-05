import { describe, it, expect } from 'vitest';
import { techniquesInOrder, techniqueNameById, findNextHint } from '../src/logic/techniques';
import type { TechniqueId } from '../src/types/hints';
import { createEmptyPuzzleDef, createEmptyPuzzleState } from '../src/types/puzzle';
import { TEST_REGIONS } from './testBoard';

describe('Technique Ordering', () => {
  it('should have all techniques in the correct order per requirements', () => {
    // Techniques are ordered with more specific pattern-matching techniques
    // before general uniqueness techniques (by-a-thread) to ensure they get tried first
    const expectedOrder: TechniqueId[] = [
      'trivial-marks',
      'locked-line',
      'adjacent-row-col',
      'two-by-two',
      'exact-fill',
      'simple-shapes',
      'cross-pressure',
      'cross-empty-patterns',
      'shared-row-column',
      'exclusion',
      'pressured-exclusion',
      'adjacent-exclusion',
      'forced-placement',
      'undercounting',
      'overcounting',
      'finned-counts',
      'composite-shapes',
      'squeeze',
      'set-differentials',
      'subset-constraint-squeeze',
      'at-sea',
      'kissing-ls',
      'the-m',
      'pressured-ts',
      'pattern-matching',
      'entanglement',
      'fish',
      'n-rooks',
      'by-a-thread',
      'by-a-thread-at-sea',
    ];

    const actualOrder = techniquesInOrder.map(t => t.id);
    expect(actualOrder).toEqual(expectedOrder);
  });

  it('should have all technique IDs mapped to names', () => {
    const allTechniqueIds: TechniqueId[] = [
      'trivial-marks',
      'locked-line',
      'adjacent-row-col',
      'two-by-two',
      'exact-fill',
      'simple-shapes',
      'cross-pressure',
      'cross-empty-patterns',
      'shared-row-column',
      'exclusion',
      'pressured-exclusion',
      'adjacent-exclusion',
      'forced-placement',
      'undercounting',
      'overcounting',
      'finned-counts',
      'composite-shapes',
      'squeeze',
      'set-differentials',
      'subset-constraint-squeeze',
      'at-sea',
      'kissing-ls',
      'the-m',
      'pressured-ts',
      'pattern-matching',
      'entanglement',
      'fish',
      'n-rooks',
      'by-a-thread',
      'by-a-thread-at-sea',
    ];

    for (const id of allTechniqueIds) {
      expect(techniqueNameById[id]).toBeDefined();
      expect(typeof techniqueNameById[id]).toBe('string');
      expect(techniqueNameById[id].length).toBeGreaterThan(0);
    }
  });

  it('should have exactly 30 techniques registered', () => {
    expect(techniquesInOrder).toHaveLength(30);
  });

  it('should have unique technique IDs', () => {
    const ids = techniquesInOrder.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all techniques with valid findHint functions', () => {
    for (const technique of techniquesInOrder) {
      expect(technique.findHint).toBeDefined();
      expect(typeof technique.findHint).toBe('function');
    }
  });

  it('should return hint from earliest applicable technique when multiple techniques apply', () => {
    // Create a puzzle state where multiple techniques could apply
    // We'll create a state where:
    // 1. trivial-marks applies (row with 2 stars)
    // 2. two-by-two could also apply (2x2 block with 1 star)
    const def = createEmptyPuzzleDef();
    def.regions = TEST_REGIONS;
    const state = createEmptyPuzzleState(def);

    // Place 2 stars in row 0 to trigger trivial-marks
    state.cells[0][0] = 'star';
    state.cells[0][5] = 'star';

    // Also create a 2x2 block with 1 star at rows 2-3, cols 2-3
    state.cells[2][2] = 'star';
    // Mark some cells as crosses to prevent trivial-marks from applying to them
    state.cells[2][3] = 'cross';
    state.cells[3][2] = 'cross';
    // Leave [3][3] empty so two-by-two could apply

    // findNextHint should return trivial-marks hint (earliest technique)
    const hint = findNextHint(state);
    expect(hint).not.toBeNull();
    expect(hint?.technique).toBe('trivial-marks');
  });

  it('should verify technique ordering with specific example', () => {
    // Create a puzzle state and verify that techniques are tried in order
    // by checking that findNextHint returns the first applicable technique
    const def = createEmptyPuzzleDef();
    def.regions = TEST_REGIONS;
    const state = createEmptyPuzzleState(def);

    // Place 2 stars in row 0 to make trivial-marks applicable
    state.cells[0][0] = 'star';
    state.cells[0][5] = 'star';

    // Get the hint
    const hint = findNextHint(state);
    expect(hint).not.toBeNull();
    
    // Verify it's from trivial-marks (the first technique that applies)
    expect(hint?.technique).toBe('trivial-marks');
    
    // Verify the hint is about marking crosses in row 0
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.resultCells.every(c => c.row === 0)).toBe(true);
  });

  it('should return null when no techniques apply', () => {
    // Create an empty puzzle state
    const def = createEmptyPuzzleDef();
    const state = createEmptyPuzzleState(def);

    // No techniques should apply to a completely empty puzzle
    const hint = findNextHint(state);
    expect(hint).toBeNull();
  });
});
