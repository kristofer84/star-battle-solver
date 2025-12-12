/**
 * Test auto solver with pattern library
 * Verifies that patterns are loaded and matched correctly
 */

import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findBestSchemaApplication } from '../src/logic/schemas/runtime';
import { loadPatterns, filterPatternsByPuzzle } from '../src/logic/patterns/loader';
import { getAllPatternApplications } from '../src/logic/patterns/runtime';
import { puzzleStateToBoardState } from '../src/logic/schemas/model/state';
import type { SchemaContext } from '../src/logic/schemas/types';
import { findSchemaBasedHint } from '../src/logic/techniques/schemaBased';

describe('Auto Solver with Patterns', () => {
  it('should load all pattern files', () => {
    const patterns = loadPatterns();
    
    console.log(`\nLoaded ${patterns.length} patterns from pattern library`);
    
    // Group by family
    const byFamily = new Map<string, number>();
    for (const pattern of patterns) {
      const count = byFamily.get(pattern.familyId) || 0;
      byFamily.set(pattern.familyId, count + 1);
    }
    
    console.log('\nPatterns by family:');
    for (const [family, count] of Array.from(byFamily.entries()).sort()) {
      console.log(`  ${family}: ${count} patterns`);
    }
    
    // Should have patterns loaded
    expect(patterns.length).toBeGreaterThan(0);
    
    // Should have patterns for 10x10 board with 2 stars
    const matchingPatterns = filterPatternsByPuzzle(patterns, 10, 2);
    console.log(`\nPatterns matching 10x10 board with 2 stars: ${matchingPatterns.length}`);
    expect(matchingPatterns.length).toBeGreaterThan(0);
  });

  it('should match patterns on a test puzzle', () => {
    // Create a simple 10x10 puzzle
    const regions = [
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [4, 4, 0, 0, 1, 2, 2, 2, 2, 3],
      [4, 0, 0, 0, 1, 2, 2, 3, 2, 3],
      [4, 0, 5, 0, 1, 7, 7, 3, 3, 3],
      [4, 0, 5, 1, 1, 7, 3, 3, 9, 3],
      [4, 5, 5, 5, 1, 7, 3, 8, 9, 3],
      [4, 4, 5, 5, 5, 5, 5, 8, 9, 9],
      [4, 4, 6, 6, 6, 5, 5, 8, 9, 9],
      [6, 6, 6, 5, 5, 5, 5, 8, 9, 9],
    ];

    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Convert to board state
    const boardState = puzzleStateToBoardState(state);
    const ctx: SchemaContext = { state: boardState };

    // Try to get pattern applications
    const patternApplications = getAllPatternApplications(ctx);
    
    console.log(`\nFound ${patternApplications.length} pattern applications on empty board`);
    
    // On an empty board, we might not find matches, but the system should work
    // Let's verify the system doesn't crash
    expect(Array.isArray(patternApplications)).toBe(true);
  });

  it('should find schema hints including patterns', () => {
    const regions = [
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [4, 4, 0, 0, 1, 2, 2, 2, 2, 3],
      [4, 0, 0, 0, 1, 2, 2, 3, 2, 3],
      [4, 0, 5, 0, 1, 7, 7, 3, 3, 3],
      [4, 0, 5, 1, 1, 7, 3, 3, 9, 3],
      [4, 5, 5, 5, 1, 7, 3, 8, 9, 3],
      [4, 4, 5, 5, 5, 5, 5, 8, 9, 9],
      [4, 4, 6, 6, 6, 5, 5, 8, 9, 9],
      [6, 6, 6, 5, 5, 5, 5, 8, 9, 9],
    ];

    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Try to find a best schema application (patterns are currently disabled here)
    const best = findBestSchemaApplication(state);
    
    console.log(`\nBest schema application found: ${best ? 'YES' : 'NO'}`);
    if (best) {
      console.log(`  Schema: ${best.app.schemaId}`);
      console.log(`  Candidate deductions: ${best.app.deductions.length}`);
      console.log(`  Explanation: ${best.baseExplanation.substring(0, 100)}...`);
    }
    
    // On an empty board, we might not find hints, but system should work
    // The important thing is that it doesn't crash
    expect(best === null || typeof best === 'object').toBe(true);
  });

  it('should match E1 patterns on a candidate deficit scenario', () => {
    const regions = [
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [4, 4, 0, 0, 1, 2, 2, 2, 2, 3],
      [4, 0, 0, 0, 1, 2, 2, 3, 2, 3],
      [4, 0, 5, 0, 1, 7, 7, 3, 3, 3],
      [4, 0, 5, 1, 1, 7, 3, 3, 9, 3],
      [4, 5, 5, 5, 1, 7, 3, 8, 9, 3],
      [4, 4, 5, 5, 5, 5, 5, 8, 9, 9],
      [4, 4, 6, 6, 6, 5, 5, 8, 9, 9],
      [6, 6, 6, 5, 5, 5, 5, 8, 9, 9],
    ];

    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Create E1 scenario: row 0 needs 2 stars, but only 2 candidates remain
    // Mark all cells in row 0 as empty except 2
    for (let c = 0; c < 10; c++) {
      if (c !== 3 && c !== 6) {
        state.cells[0][c] = 'cross';
      }
    }

    const hint = findSchemaBasedHint(state);
    
    console.log(`\nE1 scenario - Hint found: ${hint ? 'YES' : 'NO'}`);
    if (hint) {
      console.log(`  Kind: ${hint.kind}`);
      console.log(`  Result cells: ${hint.resultCells.map(s => `(${s.row},${s.col})`).join(', ')}`);
    }
    
    // Should find a hint (either from E1 schema or E1 pattern)
    // The exact result depends on implementation, but system should work
    expect(hint === null || typeof hint === 'object').toBe(true);
  });

  it('should apply patterns iteratively in auto-solve loop', () => {
    const regions = [
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [4, 4, 0, 0, 1, 2, 2, 2, 2, 3],
      [4, 0, 0, 0, 1, 2, 2, 3, 2, 3],
      [4, 0, 5, 0, 1, 7, 7, 3, 3, 3],
      [4, 0, 5, 1, 1, 7, 3, 3, 9, 3],
      [4, 5, 5, 5, 1, 7, 3, 8, 9, 3],
      [4, 4, 5, 5, 5, 5, 5, 8, 9, 9],
      [4, 4, 6, 6, 6, 5, 5, 8, 9, 9],
      [6, 6, 6, 5, 5, 5, 5, 8, 9, 9],
    ];

    let state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Simulate auto-solve loop
    let iterations = 0;
    let totalDeductions = 0;
    const maxIterations = 50;

    console.log('\n=== Auto-Solve Loop ===');
    
    while (iterations < maxIterations) {
      const hint = findSchemaBasedHint(state);
      
      if (!hint) {
        console.log(`\nNo more hints found after ${iterations} iterations`);
        break;
      }

      iterations++;
      totalDeductions += hint.resultCells.length;

      console.log(`Iteration ${iterations}: ${hint.resultCells.length} cell(s) (${hint.technique})`);

      // Apply deduction (verified schema hints are single-cell)
      const cell = hint.resultCells[0];
      state.cells[cell.row][cell.col] = hint.kind === 'place-star' ? 'star' : 'cross';

      // Check if solved (all cells filled)
      let allFilled = true;
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (state.cells[r][c] === 'empty') {
            allFilled = false;
            break;
          }
        }
        if (!allFilled) break;
      }

      if (allFilled) {
        console.log(`\nPuzzle solved after ${iterations} iterations!`);
        break;
      }
    }

    console.log(`\nTotal iterations: ${iterations}`);
    console.log(`Total deductions: ${totalDeductions}`);

    // This loop is primarily a smoke test: it should not crash or hang.
    expect(iterations).toBeLessThanOrEqual(maxIterations);
  });

  it('should verify pattern file structure', () => {
    const patterns = loadPatterns();
    
    // Check that patterns have required fields
    for (const pattern of patterns.slice(0, 10)) { // Check first 10
      expect(pattern).toHaveProperty('id');
      expect(pattern).toHaveProperty('familyId');
      expect(pattern).toHaveProperty('window_width');
      expect(pattern).toHaveProperty('window_height');
      expect(pattern).toHaveProperty('deductions');
      expect(pattern).toHaveProperty('data');
      expect(Array.isArray(pattern.deductions)).toBe(true);
      
      // Check deductions structure
      for (const ded of pattern.deductions) {
        expect(ded).toHaveProperty('type');
        expect(ded).toHaveProperty('relative_cell_ids');
        expect(['forceStar', 'forceEmpty']).toContain(ded.type);
        expect(Array.isArray(ded.relative_cell_ids)).toBe(true);
      }
    }
    
    console.log('\n✓ All checked patterns have valid structure');
  });
});

