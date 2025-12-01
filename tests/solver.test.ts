import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIZE,
  DEFAULT_STARS_PER_UNIT,
  type PuzzleDef,
  type PuzzleState,
  createEmptyPuzzleState,
} from '../src/types/puzzle';
import { solvePuzzle, countSolutions } from '../src/logic/search';
import { validateState } from '../src/logic/validation';
import { TEST_REGIONS } from './testBoard';

function makeDef(): PuzzleDef {
  return {
    size: DEFAULT_SIZE,
    starsPerUnit: DEFAULT_STARS_PER_UNIT,
    regions: TEST_REGIONS,
  };
}

describe('backtracking solver on test board', () => {
  it(
    'finds a complete solution obeying all constraints',
    () => {
      const def = makeDef();
      const solution = solvePuzzle(def);
      expect(solution).not.toBeNull();
      if (!solution) return;

      // No validation errors (no adjacency or over-filled units).
      const issues = validateState(solution);
      expect(issues).toEqual([]);

      // Exactly two stars per row/column.
      for (let r = 0; r < def.size; r += 1) {
        let rowStars = 0;
        for (let c = 0; c < def.size; c += 1) {
          if (solution.cells[r][c] === 'star') rowStars += 1;
        }
        expect(rowStars).toBe(def.starsPerUnit);
      }

      for (let c = 0; c < def.size; c += 1) {
        let colStars = 0;
        for (let r = 0; r < def.size; r += 1) {
          if (solution.cells[r][c] === 'star') colStars += 1;
        }
        expect(colStars).toBe(def.starsPerUnit);
      }

      // Exactly two stars per region.
      for (let id = 1; id <= 10; id += 1) {
        let regStars = 0;
        for (let r = 0; r < def.size; r += 1) {
          for (let c = 0; c < def.size; c += 1) {
            if (def.regions[r][c] === id && solution.cells[r][c] === 'star') {
              regStars += 1;
            }
          }
        }
        expect(regStars).toBe(def.starsPerUnit);
      }
    },
    20_000,
  );
});

describe('countSolutions', () => {
  it('counts 0 solutions for an impossible puzzle', () => {
    const def = makeDef();
    const state = createEmptyPuzzleState(def);
    
    // Create an impossible state: place 3 stars in row 0
    state.cells[0][0] = 'star';
    state.cells[0][3] = 'star';
    state.cells[0][6] = 'star';
    
    const result = countSolutions(state, { timeoutMs: 1000 });
    expect(result.count).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  it('counts exactly 1 solution for a valid puzzle', () => {
    const def = makeDef();
    const state = createEmptyPuzzleState(def);
    
    // Use the solver to get a valid solution
    const solution = solvePuzzle(def);
    expect(solution).not.toBeNull();
    
    if (!solution) return;
    
    // Count solutions for the complete puzzle
    const result = countSolutions(solution, { timeoutMs: 1000 });
    expect(result.count).toBe(1);
    expect(result.timedOut).toBe(false);
  });

  it('counts multiple solutions for an underconstrained puzzle', () => {
    // Create a simple puzzle where each row is its own region
    // This will have many solutions since regions don't constrain across rows
    const simpleDef: PuzzleDef = {
      size: DEFAULT_SIZE,
      starsPerUnit: DEFAULT_STARS_PER_UNIT,
      regions: Array(DEFAULT_SIZE).fill(null).map((_, row) => 
        Array(DEFAULT_SIZE).fill(row + 1)
      ),
    };
    const state = createEmptyPuzzleState(simpleDef);
    
    // This puzzle should have many solutions
    const result = countSolutions(state, { 
      maxCount: 3,  // Stop after finding 3 solutions
      timeoutMs: 5000 
    });
    
    // Should find multiple solutions (capped at 3)
    expect(result.count).toBeGreaterThan(1);
    if (result.count >= 3) {
      expect(result.cappedAtMax).toBe(true);
    }
  });

  it('respects timeout mechanism', () => {
    const def = makeDef();
    const state = createEmptyPuzzleState(def);
    
    // Empty puzzle will have many solutions, should timeout quickly
    const result = countSolutions(state, { 
      timeoutMs: 10  // Very short timeout
    });
    
    expect(result.timedOut).toBe(true);
  });

  it('respects maxCount limit', () => {
    const def = makeDef();
    const state = createEmptyPuzzleState(def);
    
    // Place a few constraints but leave it underconstrained
    state.cells[0][0] = 'star';
    state.cells[0][5] = 'star';
    
    const maxCount = 3;
    const result = countSolutions(state, { 
      maxCount,
      timeoutMs: 5000 
    });
    
    expect(result.count).toBeLessThanOrEqual(maxCount);
    if (result.count === maxCount) {
      expect(result.cappedAtMax).toBe(true);
    }
  });

  it('handles partially filled puzzle correctly', () => {
    const def = makeDef();
    const state = createEmptyPuzzleState(def);
    
    // Get a complete solution first
    const solution = solvePuzzle(def);
    expect(solution).not.toBeNull();
    if (!solution) return;
    
    // Copy first 5 rows from the solution
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < def.size; c++) {
        state.cells[r][c] = solution.cells[r][c];
      }
    }
    
    // Count solutions - should find at least 1 (the original solution)
    const result = countSolutions(state, { 
      maxCount: 10,
      timeoutMs: 5000 
    });
    
    expect(result.count).toBeGreaterThanOrEqual(1);
  });

  it('respects depth limit', () => {
    const def = makeDef();
    const state = createEmptyPuzzleState(def);
    
    // With a very low depth limit, we shouldn't find complete solutions
    const result = countSolutions(state, { 
      maxDepth: 5,
      timeoutMs: 1000 
    });
    
    // With only 5 levels of depth, we can't complete a 10×10 puzzle
    expect(result.count).toBe(0);
  });
});


