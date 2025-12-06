import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findSubsetConstraintSqueezeHint } from '../src/logic/techniques/subsetConstraintSqueeze';
import { findSubsetConstraintSqueeze, computeStats, allConstraints } from '../src/logic/stats';
import type { Constraint } from '../src/logic/stats';

function parsePuzzle(puzzleStr: string): PuzzleState {
  const lines = puzzleStr.trim().split('\n').map((line) => line.trim());
  const regions: number[][] = [];
  const stars: Array<[number, number]> = [];
  const crosses: Array<[number, number]> = [];

  for (let r = 0; r < lines.length; r += 1) {
    const cells = lines[r].split(/\s+/);
    const regionRow: number[] = [];

    for (let c = 0; c < cells.length; c += 1) {
      const match = cells[c].match(/^(\d+)([xs]?)$/);
      if (!match) {
        throw new Error(`Invalid cell ${cells[c]} at (${r}, ${c})`);
      }
      const regionId = Number(match[1]) + 1; // convert 0-indexed region ids to 1-based
      const state = match[2];

      regionRow.push(regionId);
      if (state === 's') {
        stars.push([r, c]);
      } else if (state === 'x') {
        crosses.push([r, c]);
      }
    }

    regions.push(regionRow);
  }

  const state = createEmptyPuzzleState({
    size: lines.length,
    starsPerUnit: 2,
    regions,
  });

  for (const [row, col] of stars) {
    state.cells[row][col] = 'star';
  }
  for (const [row, col] of crosses) {
    state.cells[row][col] = 'cross';
  }

  return state;
}

function formatState(state: PuzzleState): string {
  const lines: string[] = [];
  for (let r = 0; r < state.def.size; r += 1) {
    const cells: string[] = [];
    for (let c = 0; c < state.def.size; c += 1) {
      const regionId = state.def.regions[r][c] - 1; // convert back to 0-based
      const cell = state.cells[r][c];
      let suffix = '';
      if (cell === 'star') suffix = 's';
      else if (cell === 'cross') suffix = 'x';
      cells.push(`${regionId}${suffix}`);
    }
    lines.push(cells.join(' '));
  }
  return lines.join('\n');
}

const INITIAL_STATE = `0x 0x 0x 0x 0s 1x 1 1 1 1
2 2x 2s 0x 1x 1x 1 1 1 3
2 2x 0x 0x 1 3 3 3 3 3
4x 4x 0s 4x 3 3 3x 3 3x 8
4x 4x 0x 4x 3x 3 3 7 7x 8
5x 4s 4x 4s 6x 6x 7x 7x 8x 8x
5x 6x 4x 6x 6x 6 6 7 7x 8
5s 6x 6x 6 7 7x 7x 7 8 8
5x 5x 5x 6 6x 7 9 9 9 9
5x 5s 6x 6 9 9 9 9 9 9`;

const EXPECTED_STATE = `0x 0x 0x 0x 0s 1x 1 1 1 1
2 2x 2s 0x 1x 1x 1 1 1 3
2 2x 0x 0x 1 3 3 3 3 3
4x 4x 0s 4x 3 3 3x 3x 3x 8
4x 4x 0x 4x 3x 3 3x 7 7x 8
5x 4s 4x 4s 6x 6x 7x 7x 8x 8x
5x 6x 4x 6x 6x 6 6 7 7x 8
5s 6x 6x 6 7 7x 7x 7 8 8
5x 5x 5x 6 6x 7 9 9 9 9
5x 5s 6x 6 9 9 9 9 9 9`;

describe('Debug Subset Constraint Squeeze', () => {
  it('should find the expected eliminations', () => {
    const state = parsePuzzle(INITIAL_STATE);
    const expectedState = parsePuzzle(EXPECTED_STATE);

    // Find differences
    const expectedEliminations: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < state.def.size; r += 1) {
      for (let c = 0; c < state.def.size; c += 1) {
        if (state.cells[r][c] === 'empty' && expectedState.cells[r][c] === 'cross') {
          expectedEliminations.push({ row: r, col: c });
        }
      }
    }

    console.log('\n=== Expected Eliminations ===');
    console.log(expectedEliminations);
    expectedEliminations.forEach(e => {
      const regionId = state.def.regions[e.row][e.col];
      console.log(`  (${e.row},${e.col}) - Region ${regionId}`);
    });

    // Compute stats and debug constraints
    const stats = computeStats(state);
    const constraints = allConstraints(stats);

    console.log('\n=== All Constraints ===');
    constraints.forEach((c, i) => {
      console.log(`${i}: ${c.source} - ${c.description}`);
      console.log(`   minStars: ${c.minStars}, maxStars: ${c.maxStars}, cells: ${c.cells.length}`);
      if (c.cells.length <= 10) {
        console.log(`   cells: ${c.cells.map(cell => `(${cell.row},${cell.col})`).join(', ')}`);
      }
    });

    // Focus on region 4 (Region D) constraints - where expected eliminations are
    console.log('\n=== Region 4 (Region D) Constraints ===');
    const region4Constraints = constraints.filter(c => 
      c.description.includes('Region D') || 
      c.description.includes('Region 4') ||
      c.cells.some(cell => state.def.regions[cell.row][cell.col] === 4)
    );
    region4Constraints.forEach((c, i) => {
      console.log(`${i}: ${c.source} - ${c.description}`);
      console.log(`   minStars: ${c.minStars}, maxStars: ${c.maxStars}, cells: ${c.cells.length}`);
      const region4Cells = c.cells.filter(cell => state.def.regions[cell.row][cell.col] === 4);
      console.log(`   Region 4 cells: ${region4Cells.length}`);
      if (region4Cells.length <= 15) {
        console.log(`   cells: ${region4Cells.map(cell => {
          const cellState = state.cells[cell.row][cell.col];
          return `(${cell.row},${cell.col})${cellState === 'empty' ? '' : cellState === 'star' ? 's' : 'x'}`;
        }).join(', ')}`);
      }
      // Check if this constraint contains the expected elimination cells
      const hasExpected = expectedEliminations.some(e => 
        c.cells.some(cell => cell.row === e.row && cell.col === e.col)
      );
      if (hasExpected) {
        console.log(`   *** Contains expected elimination cells! ***`);
      }
    });

    // Check what cells in region 4 are empty
    console.log('\n=== Region 4 Empty Cells ===');
    const region4Empty: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < state.def.size; r += 1) {
      for (let c = 0; c < state.def.size; c += 1) {
        if (state.def.regions[r][c] === 4 && state.cells[r][c] === 'empty') {
          region4Empty.push({ row: r, col: c });
        }
      }
    }
    console.log(`Empty cells in region 4: ${region4Empty.length}`);
    console.log(region4Empty.map(c => `(${c.row},${c.col})`).join(', '));
    
    // Check rows 3 and 4 constraints specifically
    console.log('\n=== Row 3 and Row 4 Constraints ===');
    const row3Constraint = constraints.find(c => c.source === 'row' && c.description.includes('Row 3'));
    const row4Constraint = constraints.find(c => c.source === 'row' && c.description.includes('Row 4'));
    if (row3Constraint) {
      console.log(`Row 3: ${row3Constraint.description}`);
      console.log(`  minStars: ${row3Constraint.minStars}, maxStars: ${row3Constraint.maxStars}`);
      console.log(`  cells: ${row3Constraint.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    }
    if (row4Constraint) {
      console.log(`Row 4: ${row4Constraint.description}`);
      console.log(`  minStars: ${row4Constraint.minStars}, maxStars: ${row4Constraint.maxStars}`);
      console.log(`  cells: ${row4Constraint.cells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    }

    // Check for subset relationships
    console.log('\n=== Subset Relationships ===');
    for (let i = 0; i < constraints.length; i += 1) {
      for (let j = 0; j < constraints.length; j += 1) {
        if (i === j) continue;
        const small = constraints[i];
        const large = constraints[j];
        
        // Check if small is subset of large
        const largeSet = new Set(large.cells.map(c => `${c.row},${c.col}`));
        const isSubset = small.cells.every(c => largeSet.has(`${c.row},${c.col}`));
        
        if (isSubset) {
          const minStarsMatch = small.minStars > 0 && small.minStars === large.maxStars;
          console.log(`\nSubset found: ${small.source} (${small.description}) ⊆ ${large.source} (${large.description})`);
          console.log(`  small: min=${small.minStars}, max=${small.maxStars}, cells=${small.cells.length}`);
          console.log(`  large: min=${large.minStars}, max=${large.maxStars}, cells=${large.cells.length}`);
          console.log(`  minStars match: ${minStarsMatch}`);
          
          if (minStarsMatch) {
            const diff = large.cells.filter(lc => 
              !small.cells.some(sc => sc.row === lc.row && sc.col === lc.col)
            );
            const emptyDiff = diff.filter(c => state.cells[c.row][c.col] === 'empty');
            console.log(`  Difference cells: ${diff.length}, empty: ${emptyDiff.length}`);
            if (emptyDiff.length > 0) {
              console.log(`  Would eliminate: ${emptyDiff.map(c => `(${c.row},${c.col})`).join(', ')}`);
            }
          }
        }
      }
    }

    // Try to find the hint with debugging enabled
    const hint = findSubsetConstraintSqueezeHint(state, true);
    const result = findSubsetConstraintSqueeze(state, true);

    console.log('\n=== Result ===');
    if (result) {
      console.log(`Found result:`);
      console.log(`  Small: ${result.small.source} - ${result.small.description}`);
      console.log(`  Large: ${result.large.source} - ${result.large.description}`);
      console.log(`  Eliminations: ${result.eliminations.length}`);
      console.log(`  Cells: ${result.eliminations.map(c => `(${c.row},${c.col})`).join(', ')}`);
      
      // Also test the hint function to see the explanation
      const hint = findSubsetConstraintSqueezeHint(state, false);
      if (hint) {
        console.log('\n=== Hint Explanation ===');
        console.log(hint.explanation);
      }
    } else {
      console.log('No result found');
    }

    console.log('\n=== Expected vs Found ===');
    console.log(`Expected eliminations: ${expectedEliminations.length}`);
    console.log(`Found eliminations: ${result?.eliminations.length ?? 0}`);
    
    if (result) {
      const foundSet = new Set(result.eliminations.map(c => `${c.row},${c.col}`));
      const expectedSet = new Set(expectedEliminations.map(c => `${c.row},${c.col}`));
      
      const missing = expectedEliminations.filter(c => !foundSet.has(`${c.row},${c.col}`));
      const extra = result.eliminations.filter(c => !expectedSet.has(`${c.row},${c.col}`));
      
      if (missing.length > 0) {
        console.log(`Missing eliminations: ${missing.map(c => `(${c.row},${c.col})`).join(', ')}`);
      }
      if (extra.length > 0) {
        console.log(`Extra eliminations: ${extra.map(c => `(${c.row},${c.col})`).join(', ')}`);
      }
    }

    // Apply hint and check result
    if (hint) {
      const testState = parsePuzzle(INITIAL_STATE);
      for (const cell of hint.resultCells) {
        testState.cells[cell.row][cell.col] = 'cross';
      }
      
      console.log('\n=== After Applying Hint ===');
      console.log(formatState(testState));
      console.log('\n=== Expected State ===');
      console.log(formatState(expectedState));
    }

    // Assertions
    expect(result).not.toBeNull();
    if (result) {
      expect(result.eliminations.length).toBeGreaterThan(0);
      
      // Check that all expected eliminations are found
      const foundSet = new Set(result.eliminations.map(c => `${c.row},${c.col}`));
      for (const expected of expectedEliminations) {
        expect(foundSet.has(`${expected.row},${expected.col}`)).toBe(true);
      }
    }
  });
});

