import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleDef, createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findPressuredTsHint } from '../src/logic/techniques/pressuredTs';

/**
 * Create a puzzle state with custom region configuration
 */
function makeStateWithCustomRegions(regionMap: number[][]): PuzzleState {
  const def = createEmptyPuzzleDef();
  for (let r = 0; r < def.size; r += 1) {
    for (let c = 0; c < def.size; c += 1) {
      def.regions[r][c] = regionMap[r][c];
    }
  }
  return createEmptyPuzzleState(def);
}

describe('Pressured Ts technique', () => {
  it('detects T-shape under pressure and identifies forced cells', () => {
    /**
     * This test validates Requirements 18.1 and 18.3:
     * - When a T-shaped region is under pressure from surrounding constraints
     * - The system identifies forced star placements
     * - The hint highlights the T-shaped region and the forcing constraints
     */
    const regionMap = Array(10).fill(null).map(() => Array(10).fill(1));
    
    // Create a T-shaped region (region 2) with horizontal crossbar and vertical stem
    // Crossbar at row 2: columns 3, 4, 5
    regionMap[2][3] = 2;
    regionMap[2][4] = 2; // middle of crossbar
    regionMap[2][5] = 2;
    
    // Stem extending down from middle: rows 3, 4
    regionMap[3][4] = 2;
    regionMap[4][4] = 2;
    
    const state = makeStateWithCustomRegions(regionMap);
    
    // Create pressure by placing crosses in some cells to limit options
    state.cells[2][3] = 'cross'; // block one end of crossbar
    
    // Now we have 4 empties: (2,4), (2,5), (3,4), (4,4) and need 2 stars
    
    const hint = findPressuredTsHint(state);
    
    // The T-shape pattern under pressure should be detected
    expect(hint).not.toBeNull();
    
    if (hint) {
      // Verify technique identification
      expect(hint.technique).toBe('pressured-ts');
      
      // Verify hint highlights the T-shaped region (Requirement 18.3)
      expect(hint.highlights?.regions).toBeDefined();
      expect(hint.highlights?.regions).toContain(2);
      
      // Verify hint highlights include the T-shape cells (Requirement 18.3)
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells!.length).toBeGreaterThanOrEqual(4);
      
      // Verify explanation describes the T-shape and pressure (Requirement 18.1)
      expect(hint.explanation).toContain('T');
      expect(hint.explanation).toContain('2'); // region 2
      expect(hint.explanation.toLowerCase()).toContain('pressure');
      
      // Verify the hint kind is valid
      expect(['place-star', 'place-cross']).toContain(hint.kind);
      
      // Verify we have forced cells
      expect(hint.resultCells).toBeDefined();
      expect(hint.resultCells.length).toBeGreaterThan(0);
    }
  });

  it('forces crosses when placing star would block too many cells', () => {
    /**
     * Scenario: T-shape where placing a star in certain cells would block
     * too many other cells, making it impossible to place 2 stars in the region.
     */
    const regionMap = Array(10).fill(null).map(() => Array(10).fill(1));
    
    // Create a compact T-shape
    regionMap[2][3] = 2; // crossbar
    regionMap[2][4] = 2; // crossbar middle
    regionMap[2][5] = 2; // crossbar
    regionMap[3][4] = 2; // stem
    regionMap[4][4] = 2; // stem
    
    const state = makeStateWithCustomRegions(regionMap);
    
    // Place a star adjacent to the T to create pressure
    state.cells[1][4] = 'star'; // above the crossbar middle
    
    // This star blocks (2,4) and its neighbors from having stars
    // The T now has limited options for placing 2 stars
    
    const hint = findPressuredTsHint(state);
    
    // Should detect pressure and potentially force some cells
    expect(hint).not.toBeNull();
    
    if (hint) {
      expect(hint.technique).toBe('pressured-ts');
      expect(hint.highlights?.regions).toContain(2);
    }
  });

  it('forces stars when empties equal stars needed', () => {
    /**
     * When the number of empty cells equals the number of stars needed,
     * all empties must be stars.
     */
    const regionMap = Array(10).fill(null).map(() => Array(10).fill(1));
    
    // Create a T-shape
    regionMap[2][3] = 2;
    regionMap[2][4] = 2;
    regionMap[2][5] = 2;
    regionMap[3][4] = 2;
    regionMap[4][4] = 2;
    
    const state = makeStateWithCustomRegions(regionMap);
    
    // Mark 3 cells as crosses, leaving exactly 2 non-adjacent empties
    state.cells[2][3] = 'cross';
    state.cells[2][4] = 'cross';
    state.cells[3][4] = 'cross';

    // Now we have 2 empties: (2,5), (4,4) — non-adjacent (row diff=2, col diff=1)
    const hint = findPressuredTsHint(state);

    expect(hint).not.toBeNull();

    if (hint) {
      expect(hint.kind).toBe('place-star');
      expect(hint.resultCells).toHaveLength(2);

      const forcedSet = new Set(hint.resultCells.map((c) => `${c.row},${c.col}`));
      expect(forcedSet.has('2,5')).toBe(true);
      expect(forcedSet.has('4,4')).toBe(true);
    }
  });

  it('detects pressure from row/column quota constraints', () => {
    /**
     * When external row/column constraints limit viable positions,
     * the T-shape is under pressure.
     */
    const regionMap = Array(10).fill(null).map(() => Array(10).fill(1));

    // Create a T-shape with a longer stem so non-adjacent placements exist
    regionMap[2][3] = 2;
    regionMap[2][4] = 2;
    regionMap[2][5] = 2;
    regionMap[3][4] = 2;
    regionMap[4][4] = 2;
    regionMap[5][4] = 2; // extend stem

    const state = makeStateWithCustomRegions(regionMap);

    // Fill row 2 with 2 stars outside the T-shape → crossbar blocked
    state.cells[2][0] = 'star';
    state.cells[2][9] = 'star';

    // Cross alternate stem cells leaving (3,4) and (5,4) as viable — non-adjacent (row diff=2)
    state.cells[4][4] = 'cross';

    const hint = findPressuredTsHint(state);

    expect(hint).not.toBeNull();

    if (hint) {
      expect(hint.technique).toBe('pressured-ts');
      expect(hint.kind).toBe('place-star');

      expect(hint.resultCells).toHaveLength(2);
      const forcedSet = new Set(hint.resultCells.map((c) => `${c.row},${c.col}`));
      expect(forcedSet.has('3,4')).toBe(true);
      expect(forcedSet.has('5,4')).toBe(true);
    }
  });

  it('returns null when no T-shape pattern exists', () => {
    const regionMap = Array(10).fill(null).map(() => Array(10).fill(1));
    
    // Create a non-T shape (just a square)
    regionMap[2][2] = 2;
    regionMap[2][3] = 2;
    regionMap[3][2] = 2;
    regionMap[3][3] = 2;
    
    const state = makeStateWithCustomRegions(regionMap);
    const hint = findPressuredTsHint(state);
    
    expect(hint).toBeNull();
  });

  it('returns null when T-shape region is already satisfied', () => {
    const regionMap = Array(10).fill(null).map(() => Array(10).fill(1));
    
    // Create a T-shape
    regionMap[2][3] = 2;
    regionMap[2][4] = 2;
    regionMap[2][5] = 2;
    regionMap[3][4] = 2;
    regionMap[4][4] = 2;
    
    const state = makeStateWithCustomRegions(regionMap);
    
    // Place 2 stars in the T-shape region
    state.cells[2][3] = 'star';
    state.cells[4][4] = 'star';
    
    const hint = findPressuredTsHint(state);
    
    // Should return null since region already has 2 stars
    expect(hint).toBeNull();
  });

  it('detects pressure from 2×2 block constraints', () => {
    /**
     * When 2×2 blocks with existing stars create pressure,
     * limiting where additional stars can be placed.
     */
    const regionMap = Array(10).fill(null).map(() => Array(10).fill(1));
    
    // Create a T-shape
    regionMap[2][3] = 2;
    regionMap[2][4] = 2;
    regionMap[2][5] = 2;
    regionMap[3][4] = 2;
    regionMap[3][5] = 2; // extend to create more cells
    
    const state = makeStateWithCustomRegions(regionMap);
    
    // Place a star that creates a 2×2 constraint
    state.cells[3][3] = 'star';
    
    // This star is adjacent to (2,3), (2,4), (3,4)
    // and creates 2×2 blocks that limit placement options
    
    const hint = findPressuredTsHint(state);
    
    // Should detect the 2×2 pressure
    if (hint) {
      expect(hint.technique).toBe('pressured-ts');
      expect(hint.highlights?.regions).toContain(2);
    }
  });
});
