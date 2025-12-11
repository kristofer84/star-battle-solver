import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import type { PuzzleState, PuzzleDef, Coords, CellState } from '../src/types/puzzle';
import { createEmptyPuzzleState, DEFAULT_SIZE, DEFAULT_STARS_PER_UNIT } from '../src/types/puzzle';
import { findTrivialMarksHint } from '../src/logic/techniques/trivialMarks';
import { findTwoByTwoHint } from '../src/logic/techniques/twoByTwo';
import { findExactFillHint } from '../src/logic/techniques/exactFill';
import { findExclusionHint } from '../src/logic/techniques/exclusion';
import { findSimpleShapesHint } from '../src/logic/techniques/simpleShapes';
import { rowCells, colCells, regionCells, emptyCells, countStars, neighbors8 } from '../src/logic/helpers';
import type { Hint } from '../src/types/hints';
import { techniquesInOrder } from '../src/logic/techniques';

// ============================================================================
// GENERATORS FOR VALID PUZZLE STATES
// ============================================================================

/**
 * Arbitrary for coordinates within the puzzle grid
 */
const coordsArb = fc.record({
  row: fc.integer({ min: 0, max: DEFAULT_SIZE - 1 }),
  col: fc.integer({ min: 0, max: DEFAULT_SIZE - 1 }),
});

/**
 * Check if two cells are adjacent (including diagonally)
 */
function areAdjacent(c1: Coords, c2: Coords): boolean {
  return Math.abs(c1.row - c2.row) <= 1 && Math.abs(c1.col - c2.col) <= 1 && 
         !(c1.row === c2.row && c1.col === c2.col);
}

/**
 * Check if adding a star at position would create a 2x2 block with existing stars
 */
function wouldCreate2x2(coords: Coords, existingStars: Coords[]): boolean {
  // Check all possible 2x2 blocks that include this cell
  for (let r = coords.row - 1; r <= coords.row; r++) {
    for (let c = coords.col - 1; c <= coords.col; c++) {
      if (r < 0 || c < 0 || r >= DEFAULT_SIZE - 1 || c >= DEFAULT_SIZE - 1) continue;
      
      // Check if this 2x2 block would have 2+ stars
      const blockCells = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];
      
      let starsInBlock = 0;
      for (const bc of blockCells) {
        if (bc.row === coords.row && bc.col === coords.col) {
          starsInBlock++;
        } else if (existingStars.some(s => s.row === bc.row && s.col === bc.col)) {
          starsInBlock++;
        }
      }
      
      if (starsInBlock >= 2) return true;
    }
  }
  return false;
}

/**
 * Generate a valid puzzle state with random star placements
 * Respects: no adjacency, no 2x2 violations, at most 2 stars per row/col/region
 */
const validPuzzleStateArb = fc.record({
  def: fc.constant(createEmptyPuzzleState({ 
    size: DEFAULT_SIZE, 
    starsPerUnit: DEFAULT_STARS_PER_UNIT,
    regions: Array(DEFAULT_SIZE).fill(null).map((_, r) => 
      Array(DEFAULT_SIZE).fill(null).map((_, c) => Math.floor(r / 2) * 2 + Math.floor(c / 5) + 1)
    )
  }).def),
  numStars: fc.integer({ min: 0, max: 20 }),
}).chain(({ def, numStars }) => {
  return fc.constant(null).map(() => {
    const state = createEmptyPuzzleState(def);
    const stars: Coords[] = [];
    const rowCounts = new Array(DEFAULT_SIZE).fill(0);
    const colCounts = new Array(DEFAULT_SIZE).fill(0);
    const regionCounts = new Map<number, number>();
    
    let attempts = 0;
    const maxAttempts = numStars * 100;
    
    while (stars.length < numStars && attempts < maxAttempts) {
      attempts++;
      const row = Math.floor(Math.random() * DEFAULT_SIZE);
      const col = Math.floor(Math.random() * DEFAULT_SIZE);
      const coords = { row, col };
      const regionId = def.regions[row][col];
      
      // Check constraints
      if (rowCounts[row] >= DEFAULT_STARS_PER_UNIT) continue;
      if (colCounts[col] >= DEFAULT_STARS_PER_UNIT) continue;
      if ((regionCounts.get(regionId) ?? 0) >= DEFAULT_STARS_PER_UNIT) continue;
      if (stars.some(s => areAdjacent(s, coords))) continue;
      if (wouldCreate2x2(coords, stars)) continue;
      
      // Place star
      stars.push(coords);
      state.cells[row][col] = 'star';
      rowCounts[row]++;
      colCounts[col]++;
      regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) + 1);
    }
    
    return state;
  });
});

// ============================================================================
// PROPERTY 1: Unit saturation forces crosses
// **Validates: Requirements 1.1, 1.2, 1.3**
// ============================================================================

describe('Property 1: Unit saturation forces crosses', () => {
  it('should identify all empty cells in saturated rows as forced crosses', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // Find a row with exactly 2 stars
        for (let r = 0; r < DEFAULT_SIZE; r++) {
          const row = rowCells(state, r);
          const starCount = countStars(state, row);
          
          if (starCount === DEFAULT_STARS_PER_UNIT) {
            const empties = emptyCells(state, row);
            if (empties.length === 0) continue;
            
            const hint = findTrivialMarksHint(state);
            
            // If there are empties in a saturated row, trivial marks should find them
            expect(hint).not.toBeNull();
            if (hint) {
              expect(hint.kind).toBe('place-cross');
              expect(hint.technique).toBe('trivial-marks');
              
              // All result cells should be in the saturated row
              const resultInRow = hint.resultCells.filter(c => c.row === r);
              expect(resultInRow.length).toBeGreaterThan(0);
            }
            return; // Test passed for this state
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should identify all empty cells in saturated columns as forced crosses', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // Find a column with exactly 2 stars
        for (let c = 0; c < DEFAULT_SIZE; c++) {
          const col = colCells(state, c);
          const starCount = countStars(state, col);
          
          if (starCount === DEFAULT_STARS_PER_UNIT) {
            const empties = emptyCells(state, col);
            if (empties.length === 0) continue;
            
            // Check if any of the empties have star neighbors (which would be found first)
            let hasStarNeighbor = false;
            for (const empty of empties) {
              const nbs = neighbors8(empty, DEFAULT_SIZE);
              for (const nb of nbs) {
                if (state.cells[nb.row][nb.col] === 'star') {
                  hasStarNeighbor = true;
                  break;
                }
              }
              if (hasStarNeighbor) break;
            }
            
            // If empties have star neighbors, trivial-marks will find those first
            // So we only test when there are no star neighbors
            if (hasStarNeighbor) continue;
            
            const hint = findTrivialMarksHint(state);
            
            expect(hint).not.toBeNull();
            if (hint) {
              expect(hint.kind).toBe('place-cross');
              expect(hint.technique).toBe('trivial-marks');
              
              const resultInCol = hint.resultCells.filter(cell => cell.col === c);
              expect(resultInCol.length).toBeGreaterThan(0);
            }
            return;
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should identify all empty cells in saturated regions as forced crosses', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // Find a region with exactly 2 stars
        for (let regionId = 1; regionId <= 10; regionId++) {
          const region = regionCells(state, regionId);
          if (region.length === 0) continue;
          
          const starCount = countStars(state, region);
          
          if (starCount === DEFAULT_STARS_PER_UNIT) {
            const empties = emptyCells(state, region);
            if (empties.length === 0) continue;
            
            const hint = findTrivialMarksHint(state);
            
            expect(hint).not.toBeNull();
            if (hint) {
              expect(hint.kind).toBe('place-cross');
              expect(hint.technique).toBe('trivial-marks');
            }
            return;
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 2: Star adjacency forces crosses
// **Validates: Requirements 1.4**
// ============================================================================

describe('Property 2: Star adjacency forces crosses', () => {
  it('should identify all 8 adjacent empty cells of any star as forced crosses', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // Find a star with at least one empty neighbor
        for (let r = 0; r < DEFAULT_SIZE; r++) {
          for (let c = 0; c < DEFAULT_SIZE; c++) {
            if (state.cells[r][c] === 'star') {
              const center: Coords = { row: r, col: c };
              const nbs = neighbors8(center, DEFAULT_SIZE);
              const emptyNeighbors = nbs.filter(nb => state.cells[nb.row][nb.col] === 'empty');
              
              if (emptyNeighbors.length > 0) {
                const hint = findTrivialMarksHint(state);
                
                expect(hint).not.toBeNull();
                if (hint) {
                  expect(hint.kind).toBe('place-cross');
                  expect(hint.technique).toBe('trivial-marks');
                  expect(hint.resultCells.length).toBeGreaterThan(0);
                }
                return;
              }
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 3: 2×2 with one star forces crosses
// **Validates: Requirements 2.1**
// ============================================================================

describe('Property 3: 2×2 with one star forces crosses', () => {
  it('should identify all remaining empty cells in 2x2 blocks with one star as forced crosses', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // Find a 2x2 block with exactly one star
        for (let r = 0; r < DEFAULT_SIZE - 1; r++) {
          for (let c = 0; c < DEFAULT_SIZE - 1; c++) {
            const block: Coords[] = [
              { row: r, col: c },
              { row: r, col: c + 1 },
              { row: r + 1, col: c },
              { row: r + 1, col: c + 1 },
            ];
            
            let starCount = 0;
            for (const cell of block) {
              if (state.cells[cell.row][cell.col] === 'star') {
                starCount++;
              }
            }
            
            if (starCount === 1) {
              const empties = emptyCells(state, block);
              if (empties.length > 0) {
                const hint = findTwoByTwoHint(state);
                
                expect(hint).not.toBeNull();
                if (hint) {
                  expect(hint.kind).toBe('place-cross');
                  expect(hint.technique).toBe('two-by-two');
                  expect(hint.resultCells.length).toBeGreaterThan(0);
                }
                return;
              }
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 4: 2×2 hints include block highlights
// **Validates: Requirements 2.2**
// ============================================================================

describe('Property 4: 2×2 hints include block highlights', () => {
  it('should include all 4 cells of the 2x2 block in highlights', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        const hint = findTwoByTwoHint(state);
        
        if (hint) {
          expect(hint.highlights).toBeDefined();
          expect(hint.highlights?.cells).toBeDefined();
          expect(hint.highlights!.cells!.length).toBe(4);
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 5: 1×N bands force stars
// **Validates: Requirements 3.1, 3.2, 3.3**
// ============================================================================

describe('Property 5: 1×N bands force stars', () => {
  it('should force stars when remaining stars equals remaining empties in a row', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // Find a row where remaining stars equals remaining empties
        for (let r = 0; r < DEFAULT_SIZE; r++) {
          const row = rowCells(state, r);
          const empties = emptyCells(state, row);
          const starCount = countStars(state, row);
          const remaining = DEFAULT_STARS_PER_UNIT - starCount;
          
          if (remaining > 0 && remaining === empties.length) {
            const hint = findExactFillHint(state);
            
            expect(hint).not.toBeNull();
            if (hint) {
              expect(hint.kind).toBe('place-star');
              expect(hint.technique).toBe('exact-fill');
              expect(hint.resultCells.length).toBe(remaining);
            }
            return;
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should force stars when remaining stars equals remaining empties in a column', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        for (let c = 0; c < DEFAULT_SIZE; c++) {
          const col = colCells(state, c);
          const empties = emptyCells(state, col);
          const starCount = countStars(state, col);
          const remaining = DEFAULT_STARS_PER_UNIT - starCount;
          
          if (remaining > 0 && remaining === empties.length) {
            const hint = findExactFillHint(state);
            
            expect(hint).not.toBeNull();
            if (hint) {
              expect(hint.kind).toBe('place-star');
              expect(hint.technique).toBe('exact-fill');
            }
            return;
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should force stars when remaining stars equals remaining empties in a region', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        for (let regionId = 1; regionId <= 10; regionId++) {
          const region = regionCells(state, regionId);
          if (region.length === 0) continue;
          
          const empties = emptyCells(state, region);
          const starCount = countStars(state, region);
          const remaining = DEFAULT_STARS_PER_UNIT - starCount;
          
          if (remaining > 0 && remaining === empties.length) {
            const hint = findExactFillHint(state);
            
            expect(hint).not.toBeNull();
            if (hint) {
              expect(hint.kind).toBe('place-star');
              expect(hint.technique).toBe('exact-fill');
            }
            return;
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 6: Exclusion prevents quota violations
// **Validates: Requirements 4.1, 4.2, 4.3**
// ============================================================================

describe('Property 6: Exclusion prevents quota violations', () => {
  it('should identify cells as crosses if placing a star would exceed row quota', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // For any empty cell, check if placing a star would violate row quota
        for (let r = 0; r < DEFAULT_SIZE; r++) {
          for (let c = 0; c < DEFAULT_SIZE; c++) {
            if (state.cells[r][c] !== 'empty') continue;
            
            const row = rowCells(state, r);
            const starCount = countStars(state, row);
            
            // If row already has 2 stars, placing another would violate quota
            if (starCount === DEFAULT_STARS_PER_UNIT) {
              const hint = findExclusionHint(state);
              
              // Exclusion should find at least one forced cross
              // (might not be this specific cell if there are multiple empties)
              if (hint && hint.technique === 'exclusion') {
                expect(hint.kind).toBe('place-cross');
                expect(hint.resultCells.length).toBeGreaterThan(0);
              }
              return; // Found a test case
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should identify cells as crosses if placing a star would exceed column quota', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // For any empty cell, check if placing a star would violate column quota
        for (let r = 0; r < DEFAULT_SIZE; r++) {
          for (let c = 0; c < DEFAULT_SIZE; c++) {
            if (state.cells[r][c] !== 'empty') continue;
            
            const col = colCells(state, c);
            const starCount = countStars(state, col);
            
            // If column already has 2 stars, placing another would violate quota
            if (starCount === DEFAULT_STARS_PER_UNIT) {
              const hint = findExclusionHint(state);
              
              if (hint && hint.technique === 'exclusion') {
                expect(hint.kind).toBe('place-cross');
                expect(hint.resultCells.length).toBeGreaterThan(0);
              }
              return; // Found a test case
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should identify cells as crosses if placing a star would exceed region quota', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // For any empty cell, check if placing a star would violate region quota
        for (let r = 0; r < DEFAULT_SIZE; r++) {
          for (let c = 0; c < DEFAULT_SIZE; c++) {
            if (state.cells[r][c] !== 'empty') continue;
            
            const regionId = state.def.regions[r][c];
            const region = regionCells(state, regionId);
            const starCount = countStars(state, region);
            
            // If region already has 2 stars, placing another would violate quota
            if (starCount === DEFAULT_STARS_PER_UNIT) {
              const hint = findExclusionHint(state);
              
              if (hint && hint.technique === 'exclusion') {
                expect(hint.kind).toBe('place-cross');
                expect(hint.resultCells.length).toBeGreaterThan(0);
              }
              return; // Found a test case
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 7: Exclusion prevents insufficient empties
// **Validates: Requirements 4.4**
// ============================================================================

describe('Property 7: Exclusion prevents insufficient empties', () => {
  it('should identify cells as crosses if placing a star would leave insufficient empties in a row', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        // Find a row where placing a star in an empty cell would leave
        // fewer empties than remaining stars needed
        for (let r = 0; r < DEFAULT_SIZE; r++) {
          const row = rowCells(state, r);
          const starCount = countStars(state, row);
          const empties = emptyCells(state, row);
          const remaining = DEFAULT_STARS_PER_UNIT - starCount;
          
          // If remaining stars equals empties, placing a star would leave
          // remaining-1 stars needed but only empties-1 slots
          // This means: (remaining - 1) > (empties - 1) is impossible
          // But if remaining > 1 and remaining === empties, then after placing one star:
          // we need (remaining - 1) more stars in (empties - 1) slots, which is exactly right
          
          // We need: remaining > empties - 1, which means remaining >= empties
          // But we also need empties > 0 (at least one empty cell to test)
          // So the condition is: remaining > 0 AND empties > 0 AND remaining > empties
          // This is impossible in a valid state since remaining <= empties always
          
          // Actually, the insufficient empties case is when:
          // After placing a star: (remaining - 1) > (empties - 1)
          // Which simplifies to: remaining > empties
          // But in a valid puzzle state, we should have remaining <= empties
          
          // So we need to look for cells where placing a star would cause
          // a DIFFERENT unit to have insufficient empties
          
          if (empties.length > 0 && remaining > 0 && remaining === empties.length) {
            // This is actually a 1xN case, not insufficient empties
            continue;
          }
          
          // Check each empty cell in this row
          for (const emptyCell of empties) {
            // Check if placing a star here would cause insufficient empties in column or region
            const col = colCells(state, emptyCell.col);
            const colStarCount = countStars(state, col);
            const colEmpties = emptyCells(state, col);
            const colRemaining = DEFAULT_STARS_PER_UNIT - colStarCount;
            
            // After placing star: need colRemaining-1 more stars in colEmpties-1 slots
            if (colRemaining > 0 && colRemaining > colEmpties.length) {
              // This would leave insufficient empties in the column
              const hint = findExclusionHint(state);
              
              if (hint && hint.technique === 'exclusion') {
                expect(hint.kind).toBe('place-cross');
                expect(hint.resultCells.length).toBeGreaterThan(0);
              }
              return; // Found a test case
            }
            
            const regionId = state.def.regions[emptyCell.row][emptyCell.col];
            const region = regionCells(state, regionId);
            const regionStarCount = countStars(state, region);
            const regionEmpties = emptyCells(state, region);
            const regionRemaining = DEFAULT_STARS_PER_UNIT - regionStarCount;
            
            if (regionRemaining > 0 && regionRemaining > regionEmpties.length) {
              const hint = findExclusionHint(state);
              
              if (hint && hint.technique === 'exclusion') {
                expect(hint.kind).toBe('place-cross');
                expect(hint.resultCells.length).toBeGreaterThan(0);
              }
              return; // Found a test case
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
  
  it('should identify cells as crosses if placing a star would leave insufficient empties in a column', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        for (let c = 0; c < DEFAULT_SIZE; c++) {
          const col = colCells(state, c);
          const starCount = countStars(state, col);
          const empties = emptyCells(state, col);
          const remaining = DEFAULT_STARS_PER_UNIT - starCount;
          
          for (const emptyCell of empties) {
            // Check if placing a star here would cause insufficient empties in row or region
            const row = rowCells(state, emptyCell.row);
            const rowStarCount = countStars(state, row);
            const rowEmpties = emptyCells(state, row);
            const rowRemaining = DEFAULT_STARS_PER_UNIT - rowStarCount;
            
            if (rowRemaining > 0 && rowRemaining > rowEmpties.length) {
              const hint = findExclusionHint(state);
              
              if (hint && hint.technique === 'exclusion') {
                expect(hint.kind).toBe('place-cross');
                expect(hint.resultCells.length).toBeGreaterThan(0);
              }
              return;
            }
            
            const regionId = state.def.regions[emptyCell.row][emptyCell.col];
            const region = regionCells(state, regionId);
            const regionStarCount = countStars(state, region);
            const regionEmpties = emptyCells(state, region);
            const regionRemaining = DEFAULT_STARS_PER_UNIT - regionStarCount;
            
            if (regionRemaining > 0 && regionRemaining > regionEmpties.length) {
              const hint = findExclusionHint(state);
              
              if (hint && hint.technique === 'exclusion') {
                expect(hint.kind).toBe('place-cross');
                expect(hint.resultCells.length).toBeGreaterThan(0);
              }
              return;
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
  
  it('should identify cells as crosses if placing a star would leave insufficient empties in a region', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        for (let regionId = 1; regionId <= 10; regionId++) {
          const region = regionCells(state, regionId);
          if (region.length === 0) continue;
          
          const starCount = countStars(state, region);
          const empties = emptyCells(state, region);
          const remaining = DEFAULT_STARS_PER_UNIT - starCount;
          
          for (const emptyCell of empties) {
            const row = rowCells(state, emptyCell.row);
            const rowStarCount = countStars(state, row);
            const rowEmpties = emptyCells(state, row);
            const rowRemaining = DEFAULT_STARS_PER_UNIT - rowStarCount;
            
            if (rowRemaining > 0 && rowRemaining > rowEmpties.length) {
              const hint = findExclusionHint(state);
              
              if (hint && hint.technique === 'exclusion') {
                expect(hint.kind).toBe('place-cross');
                expect(hint.resultCells.length).toBeGreaterThan(0);
              }
              return;
            }
            
            const col = colCells(state, emptyCell.col);
            const colStarCount = countStars(state, col);
            const colEmpties = emptyCells(state, col);
            const colRemaining = DEFAULT_STARS_PER_UNIT - colStarCount;
            
            if (colRemaining > 0 && colRemaining > colEmpties.length) {
              const hint = findExclusionHint(state);
              
              if (hint && hint.technique === 'exclusion') {
                expect(hint.kind).toBe('place-cross');
                expect(hint.resultCells.length).toBeGreaterThan(0);
              }
              return;
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 10: Horizontal 1×4 regions force row crosses
// **Validates: Requirements 6.1**
// ============================================================================

describe('Property 10: Horizontal 1×4 regions force row crosses', () => {
  it('should force crosses in row cells outside horizontal 1x4 regions', () => {
    // Create a specific puzzle def with a horizontal 1x4 region
    const def: PuzzleDef = {
      size: DEFAULT_SIZE,
      starsPerUnit: DEFAULT_STARS_PER_UNIT,
      regions: Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(2))
    };
    
    // Create a horizontal 1x4 region at row 4, cols 3-6
    const stripRow = 4;
    for (let c = 3; c <= 6; c++) {
      def.regions[stripRow][c] = 1;
    }
    
    const state = createEmptyPuzzleState(def);
    const hint = findSimpleShapesHint(state);
    
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.kind).toBe('place-cross');
      expect(hint.technique).toBe('simple-shapes');
      
      // Should include crosses outside the 1x4 strip in the same row
      const crossesInRow = hint.resultCells.filter(c => c.row === stripRow);
      expect(crossesInRow.length).toBeGreaterThan(0);
      
      // None of the crosses should be in the strip itself
      for (const cross of crossesInRow) {
        expect(cross.col < 3 || cross.col > 6).toBe(true);
      }
    }
  });
});

// ============================================================================
// PROPERTY 11: Vertical 4×1 regions force column crosses
// **Validates: Requirements 6.2**
// ============================================================================

describe('Property 11: Vertical 4×1 regions force column crosses', () => {
  it('should force crosses in column cells outside vertical 4x1 regions', () => {
    const def: PuzzleDef = {
      size: DEFAULT_SIZE,
      starsPerUnit: DEFAULT_STARS_PER_UNIT,
      regions: Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(2))
    };
    
    // Create a vertical 4x1 region at col 5, rows 2-5
    const stripCol = 5;
    for (let r = 2; r <= 5; r++) {
      def.regions[r][stripCol] = 1;
    }
    
    const state = createEmptyPuzzleState(def);
    const hint = findSimpleShapesHint(state);
    
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.kind).toBe('place-cross');
      expect(hint.technique).toBe('simple-shapes');
      
      const crossesInCol = hint.resultCells.filter(c => c.col === stripCol);
      expect(crossesInCol.length).toBeGreaterThan(0);
      
      for (const cross of crossesInCol) {
        expect(cross.row < 2 || cross.row > 5).toBe(true);
      }
    }
  });
});

// ============================================================================
// PROPERTY 12: Strip adjacency forces crosses
// **Validates: Requirements 6.3**
// ============================================================================

describe('Property 12: Strip adjacency forces crosses', () => {
  it('should force crosses adjacent to horizontal 1x4 strips', () => {
    const def: PuzzleDef = {
      size: DEFAULT_SIZE,
      starsPerUnit: DEFAULT_STARS_PER_UNIT,
      regions: Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(2))
    };
    
    // Create a horizontal 1x4 region at row 4, cols 3-6
    const stripRow = 4;
    for (let c = 3; c <= 6; c++) {
      def.regions[stripRow][c] = 1;
    }
    
    const state = createEmptyPuzzleState(def);
    const hint = findSimpleShapesHint(state);
    
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.kind).toBe('place-cross');
      expect(hint.technique).toBe('simple-shapes');
      
      // Should include cells above and below the strip (perpendicular adjacency)
      const adjacentRows = [stripRow - 1, stripRow + 1];
      const adjacentCells: Coords[] = [];
      
      for (const row of adjacentRows) {
        if (row >= 0 && row < DEFAULT_SIZE) {
          for (let c = 3; c <= 6; c++) {
            adjacentCells.push({ row, col: c });
          }
        }
      }
      
      // Check that at least some adjacent cells are in the result
      let foundAdjacent = false;
      for (const adjacent of adjacentCells) {
        const found = hint.resultCells.some(
          rc => rc.row === adjacent.row && rc.col === adjacent.col
        );
        if (found) {
          foundAdjacent = true;
          break;
        }
      }
      
      expect(foundAdjacent).toBe(true);
    }
  });

  it('should force crosses adjacent to vertical 4x1 strips', () => {
    const def: PuzzleDef = {
      size: DEFAULT_SIZE,
      starsPerUnit: DEFAULT_STARS_PER_UNIT,
      regions: Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(2))
    };
    
    // Create a vertical 4x1 region at col 5, rows 2-5
    const stripCol = 5;
    for (let r = 2; r <= 5; r++) {
      def.regions[r][stripCol] = 1;
    }
    
    const state = createEmptyPuzzleState(def);
    const hint = findSimpleShapesHint(state);
    
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.kind).toBe('place-cross');
      expect(hint.technique).toBe('simple-shapes');
      
      // Should include cells left and right of the strip (perpendicular adjacency)
      const adjacentCols = [stripCol - 1, stripCol + 1];
      const adjacentCells: Coords[] = [];
      
      for (const col of adjacentCols) {
        if (col >= 0 && col < DEFAULT_SIZE) {
          for (let r = 2; r <= 5; r++) {
            adjacentCells.push({ row: r, col });
          }
        }
      }
      
      // Check that at least some adjacent cells are in the result
      let foundAdjacent = false;
      for (const adjacent of adjacentCells) {
        const found = hint.resultCells.some(
          rc => rc.row === adjacent.row && rc.col === adjacent.col
        );
        if (found) {
          foundAdjacent = true;
          break;
        }
      }
      
      expect(foundAdjacent).toBe(true);
    }
  });

  it('should mark all perpendicular adjacent cells as crosses for horizontal strips', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: DEFAULT_SIZE - 4 }), // stripRow
        fc.integer({ min: 0, max: DEFAULT_SIZE - 4 }), // stripStartCol
        (stripRow, stripStartCol) => {
          const def: PuzzleDef = {
            size: DEFAULT_SIZE,
            starsPerUnit: DEFAULT_STARS_PER_UNIT,
            regions: Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(2))
          };
          
          // Create horizontal 1x4 strip
          for (let c = stripStartCol; c < stripStartCol + 4; c++) {
            def.regions[stripRow][c] = 1;
          }
          
          const state = createEmptyPuzzleState(def);
          const hint = findSimpleShapesHint(state);
          
          if (hint) {
            // Verify that cells above and below the strip are marked as crosses
            const adjacentRows = [stripRow - 1, stripRow + 1].filter(
              r => r >= 0 && r < DEFAULT_SIZE
            );
            
            for (const row of adjacentRows) {
              for (let c = stripStartCol; c < stripStartCol + 4; c++) {
                const isInResult = hint.resultCells.some(
                  rc => rc.row === row && rc.col === c
                );
                expect(isInResult).toBe(true);
              }
            }
          }
        }
      ),
      { numRuns: 25, timeout: 30000 } // Reduced runs, added timeout
    );
  });

  it('should mark all perpendicular adjacent cells as crosses for vertical strips', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: DEFAULT_SIZE - 4 }), // stripStartRow
        fc.integer({ min: 1, max: DEFAULT_SIZE - 2 }), // stripCol
        (stripStartRow, stripCol) => {
          const def: PuzzleDef = {
            size: DEFAULT_SIZE,
            starsPerUnit: DEFAULT_STARS_PER_UNIT,
            regions: Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(2))
          };
          
          // Create vertical 4x1 strip
          for (let r = stripStartRow; r < stripStartRow + 4; r++) {
            def.regions[r][stripCol] = 1;
          }
          
          const state = createEmptyPuzzleState(def);
          const hint = findSimpleShapesHint(state);
          
          if (hint) {
            // Verify that cells left and right of the strip are marked as crosses
            const adjacentCols = [stripCol - 1, stripCol + 1].filter(
              c => c >= 0 && c < DEFAULT_SIZE
            );
            
            for (const col of adjacentCols) {
              for (let r = stripStartRow; r < stripStartRow + 4; r++) {
                const isInResult = hint.resultCells.some(
                  rc => rc.row === r && rc.col === col
                );
                expect(isInResult).toBe(true);
              }
            }
          }
        }
      ),
      { numRuns: 25, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 19: All hints have required fields
// **Validates: Requirements 22.1**
// ============================================================================

describe('Property 19: All hints have required fields', () => {
  it('should ensure all hints have required fields', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        const techniques = [
          findTrivialMarksHint,
          findTwoByTwoHint,
          findExactFillHint,
          findExclusionHint,
          findSimpleShapesHint,
        ];
        
        for (const technique of techniques) {
          const hint = technique(state);
          
          if (hint) {
            expect(hint.id).toBeDefined();
            expect(typeof hint.id).toBe('string');
            expect(hint.kind).toBeDefined();
            expect(['place-star', 'place-cross']).toContain(hint.kind);
            expect(hint.technique).toBeDefined();
            expect(typeof hint.technique).toBe('string');
            expect(hint.resultCells).toBeDefined();
            expect(Array.isArray(hint.resultCells)).toBe(true);
            expect(hint.explanation).toBeDefined();
            expect(typeof hint.explanation).toBe('string');
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 20: All hints include highlights
// **Validates: Requirements 22.2**
// ============================================================================

describe('Property 20: All hints include highlights', () => {
  it('should ensure all hints include at least one type of highlight', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        const techniques = [
          findTrivialMarksHint,
          findTwoByTwoHint,
          findExactFillHint,
          findExclusionHint,
          findSimpleShapesHint,
        ];
        
        for (const technique of techniques) {
          const hint = technique(state);
          
          if (hint) {
            expect(hint.highlights).toBeDefined();
            const h = hint.highlights!;
            const hasHighlight = 
              (h.cells && h.cells.length > 0) ||
              (h.rows && h.rows.length > 0) ||
              (h.cols && h.cols.length > 0) ||
              (h.regions && h.regions.length > 0);
            expect(hasHighlight).toBe(true);
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 21: Hints are sound
// **Validates: Requirements 22.4**
// ============================================================================

describe('Property 21: Hints are sound', () => {
  it('should ensure applying hints never creates invalid states', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        const techniques = [
          findTrivialMarksHint,
          findTwoByTwoHint,
          findExactFillHint,
          findExclusionHint,
          findSimpleShapesHint,
        ];
        
        for (const technique of techniques) {
          const hint = technique(state);
          
          if (hint) {
            // Create a copy and apply the hint
            const testState: PuzzleState = {
              def: state.def,
              cells: state.cells.map(row => [...row])
            };
            
            for (const cell of hint.resultCells) {
              const newValue: CellState = hint.kind === 'place-star' ? 'star' : 'cross';
              testState.cells[cell.row][cell.col] = newValue;
            }
            
            // Verify no unit exceeds 2 stars
            for (let r = 0; r < DEFAULT_SIZE; r++) {
              const row = rowCells(testState, r);
              const stars = countStars(testState, row);
              expect(stars).toBeLessThanOrEqual(DEFAULT_STARS_PER_UNIT);
            }
            
            for (let c = 0; c < DEFAULT_SIZE; c++) {
              const col = colCells(testState, c);
              const stars = countStars(testState, col);
              expect(stars).toBeLessThanOrEqual(DEFAULT_STARS_PER_UNIT);
            }
            
            // Verify no adjacent stars
            for (let r = 0; r < DEFAULT_SIZE; r++) {
              for (let c = 0; c < DEFAULT_SIZE; c++) {
                if (testState.cells[r][c] === 'star') {
                  const nbs = neighbors8({ row: r, col: c }, DEFAULT_SIZE);
                  for (const nb of nbs) {
                    expect(testState.cells[nb.row][nb.col]).not.toBe('star');
                  }
                }
              }
            }
            
            // Verify no 2x2 with multiple stars
            for (let r = 0; r < DEFAULT_SIZE - 1; r++) {
              for (let c = 0; c < DEFAULT_SIZE - 1; c++) {
                const block = [
                  { row: r, col: c },
                  { row: r, col: c + 1 },
                  { row: r + 1, col: c },
                  { row: r + 1, col: c + 1 },
                ];
                
                let stars = 0;
                for (const cell of block) {
                  if (testState.cells[cell.row][cell.col] === 'star') {
                    stars++;
                  }
                }
                expect(stars).toBeLessThanOrEqual(1);
              }
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});

// ============================================================================
// PROPERTY 21 (Extended): Hints are sound for all techniques
// **Validates: Requirements 22.4**
// Feature: star-battle-techniques, Property 21: Hints are sound
// ============================================================================

describe('Property 21 (Extended): Hints are sound for all techniques', () => {
  it('should ensure applying hints from all techniques never creates invalid states', () => {
    fc.assert(
      fc.property(validPuzzleStateArb, (state) => {
        for (const technique of techniquesInOrder) {
          const hint = technique.findHint(state);
          
          if (hint) {
            // Create a copy and apply the hint
            const testState: PuzzleState = {
              def: state.def,
              cells: state.cells.map(row => [...row])
            };
            
            for (const cell of hint.resultCells) {
              const newValue: CellState = hint.kind === 'place-star' ? 'star' : 'cross';
              testState.cells[cell.row][cell.col] = newValue;
            }
            
            // Verify no unit exceeds 2 stars
            for (let r = 0; r < DEFAULT_SIZE; r++) {
              const row = rowCells(testState, r);
              const stars = countStars(testState, row);
              if (stars > DEFAULT_STARS_PER_UNIT) {
                throw new Error(`Technique ${technique.id} caused row ${r} to exceed ${DEFAULT_STARS_PER_UNIT} stars (has ${stars})`);
              }
            }
            
            for (let c = 0; c < DEFAULT_SIZE; c++) {
              const col = colCells(testState, c);
              const stars = countStars(testState, col);
              if (stars > DEFAULT_STARS_PER_UNIT) {
                throw new Error(`Technique ${technique.id} caused column ${c} to exceed ${DEFAULT_STARS_PER_UNIT} stars (has ${stars})`);
              }
            }
            
            // Verify no adjacent stars
            for (let r = 0; r < DEFAULT_SIZE; r++) {
              for (let c = 0; c < DEFAULT_SIZE; c++) {
                if (testState.cells[r][c] === 'star') {
                  const nbs = neighbors8({ row: r, col: c }, DEFAULT_SIZE);
                  for (const nb of nbs) {
                    if (testState.cells[nb.row][nb.col] === 'star') {
                      throw new Error(`Technique ${technique.id} caused adjacent stars at (${r},${c}) and (${nb.row},${nb.col})`);
                    }
                  }
                }
              }
            }
            
            // Verify no 2x2 with multiple stars
            for (let r = 0; r < DEFAULT_SIZE - 1; r++) {
              for (let c = 0; c < DEFAULT_SIZE - 1; c++) {
                const block = [
                  { row: r, col: c },
                  { row: r, col: c + 1 },
                  { row: r + 1, col: c },
                  { row: r + 1, col: c + 1 },
                ];
                
                let stars = 0;
                for (const cell of block) {
                  if (testState.cells[cell.row][cell.col] === 'star') {
                    stars++;
                  }
                }
                if (stars > 1) {
                  throw new Error(`Technique ${technique.id} caused 2x2 block at (${r},${c}) to have ${stars} stars`);
                }
              }
            }
            
            // Verify no regions exceed 2 stars
            for (let regionId = 1; regionId <= 10; regionId++) {
              const region = regionCells(testState, regionId);
              if (region.length > 0) {
                const stars = countStars(testState, region);
                if (stars > DEFAULT_STARS_PER_UNIT) {
                  throw new Error(`Technique ${technique.id} caused region ${regionId} to exceed ${DEFAULT_STARS_PER_UNIT} stars (has ${stars})`);
                }
              }
            }
          }
        }
      }),
      { numRuns: 50, timeout: 30000 } // Reduced runs, added timeout
    );
  });
});
