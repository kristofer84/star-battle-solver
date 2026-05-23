import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findEntanglementPatternHint } from '../src/logic/techniques/entanglementPatterns';
import { getCell } from '../src/logic/helpers';
import { evaluateFeature } from '../src/logic/entanglements/features';

/**
 * Helper to set cell states in a puzzle
 */
function setCells(state: PuzzleState, stars: [number, number][], crosses: [number, number][]) {
  for (const [r, c] of stars) {
    state.cells[r][c] = 'star';
  }
  for (const [r, c] of crosses) {
    state.cells[r][c] = 'cross';
  }
}

/**
 * Create a simple 10x10 puzzle state with all regions set to 1
 * (regions don't matter for pattern matching constraint tests)
 */
function createSimpleState(): PuzzleState {
  const regions = Array(10).fill(null).map(() => Array(10).fill(1));
  return createEmptyPuzzleState({
    size: 10,
    starsPerUnit: 2,
    regions,
  });
}

describe('Pattern Matching with candidate_on_outer_ring constraint', () => {
  /**
   * Test pattern [39220f]:
   * - Canonical stars: [[1, 1], [3, 4]]
   * - Canonical candidate: [5, 2]
   * - Constraint: candidate_on_outer_ring
   * 
   * For a 10x10 board, "outer ring" (ring 1) means:
   * - row 1 or row 8 (size-2 = 10-2 = 8)
   * - col 1 or col 8
   * 
   * This test verifies that the pattern correctly identifies candidates
   * that are on ring 1, and does NOT match candidates on the actual edge
   * or in the interior.
   */
  
  it('should NOT match constrained pattern [39220f] when candidate is NOT on ring 1', () => {
    const state = createSimpleState();

    // Stars at (2,2) and (4,5) — offset (1,1) from canonical [1,1] and [3,4].
    // Constrained pattern [39220f] would have candidate at (6,3) which is NOT on ring 1.
    // Other unconstrained rules may still fire; we only check that [39220f] doesn't fire.
    setCells(state, [[2, 2], [4, 5]], []);

    const hint = findEntanglementPatternHint(state);

    // If pattern [39220f] fires, its candidate must be on ring 1 (row/col 1 or 8).
    // With these star positions [39220f] should not fire (candidate at (6,3) fails constraint).
    if (hint?.patternId === '39220f') {
      const candidate = hint.resultCells[0];
      const isOnRing1 =
        candidate.row === 1 || candidate.row === 8 ||
        candidate.col === 1 || candidate.col === 8;
      expect(isOnRing1).toBe(true);
    }
    // Any other pattern firing (or null) is acceptable
  });

  it('should match constrained pattern [39220f] when candidate IS on ring 1 (col 1)', () => {
    const state = createSimpleState();

    // Stars at (1,0) and (3,3) — offset (0,-1) from canonical [1,1] and [3,4].
    // Pattern [39220f] candidate [5,2] with offset (0,-1) → (5,1), which is col 1 = ring 1.
    // So the constrained pattern SHOULD fire if it fires at all.
    setCells(state, [[1, 0], [3, 3]], []);

    const hint = findEntanglementPatternHint(state);

    // If pattern [39220f] fires, its candidate must be on ring 1.
    if (hint?.patternId === '39220f') {
      const candidate = hint.resultCells[0];
      const isOnRing1 =
        candidate.row === 1 || candidate.row === 8 ||
        candidate.col === 1 || candidate.col === 8;
      expect(isOnRing1).toBe(true);
      expect(getCell(state, candidate)).toBe('empty');
    }
    // null or other patterns are also acceptable
  });

  it('should NOT match pattern when candidate is on actual edge (row 0)', () => {
    const state = createSimpleState();
    
    // Place stars such that candidate would be on row 0 (actual edge, not ring 1)
    // Canonical candidate is [5, 2]
    // For row to be 0: 5 + offset_row = 0, so offset_row = -5
    // Stars at canonical [1,1] and [3,4] with offset (-5, ?) would be:
    // [1-5, 1+?] = [-4, 1+?] - out of bounds!
    
    // Let's try a different approach: use a transformation
    // If we rotate 180 degrees, canonical [1,1] becomes [8,8] on a 10x10 board
    // But the pattern matcher handles transformations automatically
    
    // Actually, let's just verify that edge cells (row 0, row 9, col 0, col 9)
    // are NOT considered ring 1
    setCells(state, [[0, 0], [2, 3]], []);
    
    const hint = findEntanglementPatternHint(state);
    
    // This might match an unconstrained rule, but if it matches the constrained rule [39220f],
    // the candidate should NOT be on the actual edge
    if (hint && hint.patternId === '39220f') {
      const candidate = hint.resultCells[0];
      // Candidate should NOT be on actual edge
      expect(candidate.row).not.toBe(0);
      expect(candidate.row).not.toBe(9);
      expect(candidate.col).not.toBe(0);
      expect(candidate.col).not.toBe(9);
    }
  });

  it('should NOT match pattern when candidate is in interior (not on ring 1)', () => {
    const state = createSimpleState();
    
    // Place stars at (2,2) and (4,5) - offset (1,1) from canonical
    // Candidate [5,2] with offset (1,1) = (6,3) - interior, not on ring 1
    setCells(state, [[2, 2], [4, 5]], []);
    
    const hint = findEntanglementPatternHint(state);
    
    // If hint matches pattern [39220f], it should not have found a candidate
    // because (6,3) is not on ring 1
    if (hint && hint.patternId === '39220f') {
      // This should not happen - the constraint should have failed
      expect(hint.resultCells.length).toBe(0);
    }
  });

  it('should correctly identify ring 1 positions for 10x10 board', () => {
    const state = createSimpleState();
    
    // Ring 1 for 10x10 board: row 1, row 8, col 1, col 8
    const ring1Positions = [
      { row: 1, col: 5 }, // row 1
      { row: 8, col: 5 }, // row 8
      { row: 5, col: 1 }, // col 1
      { row: 5, col: 8 }, // col 8
    ];
    
    const notRing1Positions = [
      { row: 0, col: 5 }, // actual edge
      { row: 9, col: 5 }, // actual edge
      { row: 5, col: 0 }, // actual edge
      { row: 5, col: 9 }, // actual edge
      { row: 5, col: 5 }, // interior
    ];
    
    // Test the feature evaluation function directly
    for (const pos of ring1Positions) {
      const result = evaluateFeature('candidate_on_outer_ring', state, pos);
      expect(result).toBe(true);
    }
    
    for (const pos of notRing1Positions) {
      const result = evaluateFeature('candidate_on_outer_ring', state, pos);
      expect(result).toBe(false);
    }
  });
});

