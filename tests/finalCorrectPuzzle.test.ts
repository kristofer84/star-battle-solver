import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';

describe('Final Correct Puzzle', () => {
  it('should validate and solve the puzzle', () => {
    // Exact solution from user's latest message
    const solutionLines = [
      '. . . S . . S . . .',
      '. S . . . . . . S .',
      '. . . S . S . . . .',
      'S . . . . . . . . S',
      '. . . . S . S . . .',
      '. . S . . . . . S .',
      'S . . . . S . . . .',
      '. . S . . . . S . .',
      '. . . . S . . . . S',
      '. S . . . . . S . .',
    ];

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

    // Parse and apply solution
    const starPositions: [number, number][] = [];
    for (let r = 0; r < 10; r++) {
      const cells = solutionLines[r].split(' ');
      for (let c = 0; c < 10; c++) {
        if (cells[c] === 'S') {
          state.cells[r][c] = 'star';
          starPositions.push([r, c]);
        }
      }
    }

    console.log('\n=== Star Positions ===');
    starPositions.forEach(([r, c]) => {
      console.log(`  (${r}, ${c}) - Region ${regions[r][c]}`);
    });
    console.log(`Total: ${starPositions.length} stars`);

    // Check for 2×2 violations
    console.log('\n=== Checking 2×2 blocks ===');
    let violations = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const stars = [
          state.cells[r][c],
          state.cells[r][c + 1],
          state.cells[r + 1][c],
          state.cells[r + 1][c + 1],
        ].filter(cell => cell === 'star').length;
        
        if (stars >= 2) {
          console.log(`  ❌ Block at (${r},${c}): ${stars} stars`);
          violations++;
        }
      }
    }
    
    if (violations === 0) {
      console.log('  ✓ No 2×2 violations');
    }

    // Check adjacency
    console.log('\n=== Checking adjacency ===');
    let adjacencyViolations = 0;
    for (let i = 0; i < starPositions.length; i++) {
      for (let j = i + 1; j < starPositions.length; j++) {
        const [r1, c1] = starPositions[i];
        const [r2, c2] = starPositions[j];
        const rowDiff = Math.abs(r1 - r2);
        const colDiff = Math.abs(c1 - c2);
        
        if (rowDiff <= 1 && colDiff <= 1) {
          console.log(`  ❌ Stars at (${r1},${c1}) and (${r2},${c2}) are adjacent`);
          adjacencyViolations++;
        }
      }
    }
    
    if (adjacencyViolations === 0) {
      console.log('  ✓ No adjacency violations');
    }

    // Check counts
    console.log('\n=== Checking counts ===');
    const rowStars = new Array(10).fill(0);
    const colStars = new Array(10).fill(0);
    const regionStars = new Map<number, number>();

    for (const [r, c] of starPositions) {
      rowStars[r]++;
      colStars[c]++;
      const regionId = regions[r][c];
      regionStars.set(regionId, (regionStars.get(regionId) ?? 0) + 1);
    }

    console.log('Row stars:', rowStars);
    console.log('Col stars:', colStars);
    console.log('Region stars:', Array.from(regionStars.entries()).sort((a, b) => a[0] - b[0]));

    const rowOk = rowStars.every(count => count === 2);
    const colOk = colStars.every(count => count === 2);
    const regionOk = Array.from(regionStars.values()).every(count => count === 2);

    console.log(`\nRows: ${rowOk ? '✓' : '❌'}`);
    console.log(`Cols: ${colOk ? '✓' : '❌'}`);
    console.log(`Regions: ${regionOk ? '✓' : '❌'}`);

    expect(violations).toBe(0);
    expect(adjacencyViolations).toBe(0);
    expect(rowOk).toBe(true);
    expect(colOk).toBe(true);
    expect(regionOk).toBe(true);

    // Now test if solver can find this solution
    console.log('\n=== Testing Solver ===');
    const freshState = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    let stepCount = 0;
    let hint = findNextHint(freshState);
    
    while (hint && stepCount < 100) {
      stepCount++;
      
      if (stepCount <= 10) {
        console.log(`Step ${stepCount}: ${hint.technique} - ${hint.kind} (${hint.resultCells.length} cells)`);
        if (hint.kind === 'place-star') {
          console.log(`  Stars at:`, hint.resultCells);
        }
      }
      
      // Apply the hint
      for (const cell of hint.resultCells) {
        if (hint.kind === 'place-star') {
          freshState.cells[cell.row][cell.col] = 'star';
        } else if (hint.kind === 'place-cross') {
          freshState.cells[cell.row][cell.col] = 'cross';
        }
      }
      
      hint = findNextHint(freshState);
    }
    
    console.log(`\nSolver completed ${stepCount} steps`);
    
    // Check if solver found the solution
    const solverRowStars = new Array(10).fill(0);
    const solverColStars = new Array(10).fill(0);
    const solverRegionStars = new Map<number, number>();
    
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (freshState.cells[r][c] === 'star') {
          solverRowStars[r]++;
          solverColStars[c]++;
          const regionId = regions[r][c];
          solverRegionStars.set(regionId, (solverRegionStars.get(regionId) ?? 0) + 1);
        }
      }
    }
    
    console.log('Solver row stars:', solverRowStars);
    console.log('Solver col stars:', solverColStars);
    console.log('Solver region stars:', Array.from(solverRegionStars.entries()).sort((a, b) => a[0] - b[0]));
    
    const solverComplete = solverRowStars.every(count => count === 2) &&
                          solverColStars.every(count => count === 2) &&
                          Array.from(solverRegionStars.values()).every(count => count === 2);
    console.log(`\nSolver complete: ${solverComplete ? '✓' : '❌'}`);
    
    if (!solverComplete) {
      console.log('\n=== Solver got stuck ===');
      console.log('Checking what went wrong...');
      
      // Show which units are incomplete
      solverRowStars.forEach((count, i) => {
        if (count !== 2) console.log(`  Row ${i}: ${count} stars (need 2)`);
      });
      solverColStars.forEach((count, i) => {
        if (count !== 2) console.log(`  Col ${i}: ${count} stars (need 2)`);
      });
      Array.from(solverRegionStars.entries()).forEach(([id, count]) => {
        if (count !== 2) console.log(`  Region ${id}: ${count} stars (need 2)`);
      });
    }
  });
});
