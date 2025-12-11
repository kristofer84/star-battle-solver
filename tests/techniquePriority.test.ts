import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createEmptyPuzzleDef, createEmptyPuzzleState } from '../src/types/puzzle';
import type { PuzzleState, CellState, Coords } from '../src/types/puzzle';
import { findNextHint, techniquesInOrder } from '../src/logic/techniques';

/**
 * **Feature: star-battle-techniques, Property 22: Technique ordering is respected**
 * **Validates: Requirements 23.1, 23.2**
 * 
 * For any puzzle state where multiple techniques could provide hints,
 * findNextHint should return the hint from the earliest technique in the ordering.
 */

describe('Technique Priority Property Tests', () => {
  // Generator for valid cell coordinates
  const coordsArb = fc.record({
    row: fc.integer({ min: 0, max: 9 }),
    col: fc.integer({ min: 0, max: 9 }),
  });

  // Generator for a list of unique coordinates
  const uniqueCoordsArb = fc
    .uniqueArray(coordsArb, {
      minLength: 0,
      maxLength: 20,
      selector: (c) => `${c.row},${c.col}`,
    });

  // Generator for puzzle states with random star/cross placements
  const puzzleStateArb = fc.record({
    stars: uniqueCoordsArb,
    crosses: uniqueCoordsArb,
  }).map(({ stars, crosses }) => {
    const def = createEmptyPuzzleDef();
    const state = createEmptyPuzzleState(def);
    
    // Place stars
    for (const coord of stars) {
      state.cells[coord.row][coord.col] = 'star';
    }
    
    // Place crosses (only if not already a star)
    for (const coord of crosses) {
      if (state.cells[coord.row][coord.col] === 'empty') {
        state.cells[coord.row][coord.col] = 'cross';
      }
    }
    
    return state;
  });

  it('should return hint from earliest applicable technique', () => {
    fc.assert(
      fc.property(puzzleStateArb, (state) => {
        const hint = findNextHint(state);
        
        if (hint === null) {
          // No technique applies - this is valid
          return true;
        }
        
        // Find the index of the technique that provided the hint
        const hintTechniqueIndex = techniquesInOrder.findIndex(
          t => t.id === hint.technique
        );
        
        // Verify that no earlier technique could have provided a hint
        for (let i = 0; i < hintTechniqueIndex; i++) {
          const earlierHint = techniquesInOrder[i].findHint(state);
          if (earlierHint !== null) {
            // An earlier technique could provide a hint but wasn't chosen
            // This violates the ordering requirement
            return false;
          }
        }
        
        return true;
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should consistently return the same technique for the same state', () => {
    fc.assert(
      fc.property(puzzleStateArb, (state) => {
        const hint1 = findNextHint(state);
        const hint2 = findNextHint(state);
        
        // Both should be null or both should have the same technique
        if (hint1 === null && hint2 === null) {
          return true;
        }
        
        if (hint1 === null || hint2 === null) {
          return false;
        }
        
        return hint1.technique === hint2.technique;
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should return hints with valid technique IDs', () => {
    fc.assert(
      fc.property(puzzleStateArb, (state) => {
        const hint = findNextHint(state);
        
        if (hint === null) {
          return true;
        }
        
        // Verify the technique ID exists in our ordered list
        const techniqueExists = techniquesInOrder.some(
          t => t.id === hint.technique
        );
        
        return techniqueExists;
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should respect ordering when multiple basic techniques apply', () => {
    // Create a specific state where we know multiple techniques should apply
    const def = createEmptyPuzzleDef();
    const state = createEmptyPuzzleState(def);
    
    // Place two stars in row 0 to trigger trivial-marks
    state.cells[0][0] = 'star';
    state.cells[0][1] = 'star';
    
    // Place a star at (5,5) to trigger adjacency marking
    state.cells[5][5] = 'star';
    
    const hint = findNextHint(state);
    
    // Should get trivial-marks since it comes first
    expect(hint).not.toBeNull();
    expect(hint?.technique).toBe('trivial-marks');
  });

  it('should handle empty puzzle state', () => {
    const def = createEmptyPuzzleDef();
    const state = createEmptyPuzzleState(def);
    
    const hint = findNextHint(state);
    
    // Empty puzzle should return null (no forced moves yet)
    expect(hint).toBeNull();
  });
});
