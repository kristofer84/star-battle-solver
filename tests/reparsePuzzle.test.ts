import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { countSolutions } from '../src/logic/search';

describe('Reparse Puzzle', () => {
  it('should parse the puzzle exactly as provided', () => {
    // User provided puzzle in this format:
    // "0 0 0 1 1 1 2 2 3 3" etc.
    const puzzleStr = `0 0 0 1 1 1 2 2 3 3
0 0 0 1 1 1 2 2 3 3
4 4 0 0 1 2 2 2 2 3
4 0 0 0 1 2 2 3 2 3
4 0 5 0 1 7 7 3 3 3
4 0 5 1 1 7 3 3 9 3
4 5 5 5 1 7 3 8 9 3
4 4 5 5 5 5 5 8 9 9
4 4 6 6 6 5 5 8 9 9
6 6 6 5 5 5 5 8 9 9`;

    const solutionStr = `x x x s x x s x x x
x s x x x x x x s x
x x x s x s x x x s
s x x x x x x x x s
x x x x s x s x x x
x x s x x x x x s x
s x x x x s x x x x
x x s x x x x s x x
x x x x s x x x x s
x s x x x x x s x x`;

    const regions = puzzleStr.split('\n').map(line => 
      line.split(' ').map(Number)
    );

    console.log('\n=== Regions ===');
    regions.forEach((row, i) => console.log(`Row ${i}: ${row.join(' ')}`));

    const solution = solutionStr.split('\n').map(line => line.split(' '));
    
    console.log('\n=== Solution ===');
    solution.forEach((row, i) => console.log(`Row ${i}: ${row.join(' ')}`));

    // Apply solution and validate
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    const starPositions: [number, number][] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (solution[r][c] === 's') {
          state.cells[r][c] = 'star';
          starPositions.push([r, c]);
        }
      }
    }

    console.log('\n=== Star Positions ===');
    starPositions.forEach(([r, c]) => {
      console.log(`  (${r}, ${c}) - Region ${regions[r][c]}`);
    });

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
          console.log(`     Cells: (${r},${c}), (${r},${c+1}), (${r+1},${c}), (${r+1},${c+1})`);
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

    // Try to find solutions
    console.log('\n=== Searching for solutions ===');
    const emptyState = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    const result = countSolutions(emptyState, {
      maxCount: 5,
      timeoutMs: 20000,
    });

    console.log(`Found ${result.count} solution(s)`);
    console.log(`Timed out: ${result.timedOut}`);
  });
});
