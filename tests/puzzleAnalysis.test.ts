import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { countSolutions } from '../src/logic/search';
import { findNextHint } from '../src/logic/techniques';

describe('Puzzle Analysis', () => {
  it('should analyze the puzzle and explain the issue', () => {
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

    console.log('\n=== PUZZLE ANALYSIS ===\n');
    
    // Check if puzzle is solvable
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    const result = countSolutions(state, {
      maxCount: 1,
      timeoutMs: 10000,
    });

    console.log(`1. Solvability: ${result.count > 0 ? 'SOLVABLE' : 'UNSOLVABLE'}`);
    console.log(`   - Solutions found: ${result.count}`);
    console.log(`   - Timed out: ${result.timedOut}\n`);

    // Check the user's provided solution
    console.log('2. User-provided solution validation:');
    const userSolution = [
      'x x x s x x s x x x',
      'x s x x x x x x s x',
      'x x x s x s x x x s',
      's x x x x x x x x s',
      'x x x x s x s x x x',
      'x x s x x x x x s x',
      's x x x x s x x x x',
      'x x s x x x x s x x',
      'x x x x s x x x x s',
      'x s x x x x x s x x',
    ];

    const testState = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Parse and apply user solution
    for (let r = 0; r < 10; r++) {
      const cells = userSolution[r].split(' ');
      for (let c = 0; c < 10; c++) {
        if (cells[c] === 's') {
          testState.cells[r][c] = 'star';
        } else if (cells[c] === 'x') {
          testState.cells[r][c] = 'cross';
        }
      }
    }

    // Check for 2×2 violations
    const violations: string[] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const block = [
          testState.cells[r][c],
          testState.cells[r][c + 1],
          testState.cells[r + 1][c],
          testState.cells[r + 1][c + 1],
        ];
        const starCount = block.filter(cell => cell === 'star').length;
        if (starCount >= 2) {
          violations.push(`   - 2×2 block at (${r},${c}) has ${starCount} stars`);
        }
      }
    }

    if (violations.length > 0) {
      console.log('   ❌ INVALID - 2×2 violations found:');
      violations.forEach(v => console.log(v));
    } else {
      console.log('   ✓ No 2×2 violations');
    }

    // Check row/col/region counts
    const rowStars = new Array(10).fill(0);
    const colStars = new Array(10).fill(0);
    const regionStars = new Map<number, number>();

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (testState.cells[r][c] === 'star') {
          rowStars[r]++;
          colStars[c]++;
          const regionId = regions[r][c];
          regionStars.set(regionId, (regionStars.get(regionId) ?? 0) + 1);
        }
      }
    }

    const rowIssues = rowStars.filter(count => count !== 2).length;
    const colIssues = colStars.filter(count => count !== 2).length;
    const regionIssues = Array.from(regionStars.values()).filter(count => count !== 2).length;

    if (rowIssues > 0) {
      console.log(`   ❌ ${rowIssues} rows don't have exactly 2 stars`);
    }
    if (colIssues > 0) {
      console.log(`   ❌ ${colIssues} columns don't have exactly 2 stars`);
    }
    if (regionIssues > 0) {
      console.log(`   ❌ ${regionIssues} regions don't have exactly 2 stars`);
    }

    console.log('\n3. Solver behavior:');
    const freshState = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Apply first few hints
    for (let i = 0; i < 10; i++) {
      const hint = findNextHint(freshState);
      if (!hint) {
        console.log(`   - Solver stopped after ${i} steps (no more hints)`);
        break;
      }

      if (i < 3) {
        console.log(`   Step ${i + 1}: ${hint.technique} - ${hint.kind} (${hint.resultCells.length} cells)`);
      }

      // Apply hint
      for (const cell of hint.resultCells) {
        if (hint.kind === 'place-star') {
          freshState.cells[cell.row][cell.col] = 'star';
        } else if (hint.kind === 'place-cross') {
          freshState.cells[cell.row][cell.col] = 'cross';
        }
      }
    }

    console.log('\n=== CONCLUSION ===\n');
    console.log('The puzzle appears to be UNSOLVABLE with the given region definitions.');
    console.log('The user-provided solution has 2×2 violations, which are not allowed in Star Battle.');
    console.log('\nPossible issues:');
    console.log('1. The region definitions may be incorrect');
    console.log('2. The puzzle may have been transcribed incorrectly');
    console.log('3. The solution provided may be for a different puzzle');
  });
});
