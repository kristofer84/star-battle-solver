import { describe, it, expect } from 'vitest';
import type { PuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';

describe('Debug Region 7 Square Counting', () => {
  it('should find star at (4,7) in region 7 using 2x2 square counting', async () => {
    // Parse the puzzle state from user input
    const puzzleText = `
0x 0x 0x 0x 0s 1x 1 1 1 1x
2 2x 2s 0x 1x 1x 1 1x 1 3x
2 2x 0x 0x 1 3 3 3 3 3x
4x 4x 0s 4x 3 3 3x 3x 3x 8
4x 4x 0x 4x 3x 3 3x 7 7x 8
5x 4s 4x 4s 6x 6x 7x 7x 8x 8x
5x 6x 4x 6x 6x 6 6 7 7x 8
5s 6x 6x 6 7 7 7x 7x 8x 8
5x 5x 5x 6 6x 7x 9 9 9 9x
5x 5s 6x 6 9 9 9 9x 9 9x
`.trim();

    // Parse regions from the puzzle (first number in each cell)
    const regions: number[][] = [];
    const cells: string[][] = [];
    
    const lines = puzzleText.split('\n').filter(l => l.trim());
    for (let r = 0; r < lines.length; r++) {
      const line = lines[r].trim();
      const parts = line.split(/\s+/);
      regions[r] = [];
      cells[r] = [];
      
      for (let c = 0; c < parts.length; c++) {
        const part = parts[c];
        // Extract region number (first digit)
        const regionMatch = part.match(/^(\d+)/);
        const regionId = regionMatch ? parseInt(regionMatch[1]) : 0;
        regions[r][c] = regionId;
        
        // Extract cell state
        if (part.includes('s')) {
          cells[r][c] = 'star';
        } else if (part.includes('x')) {
          cells[r][c] = 'cross';
        } else {
          cells[r][c] = 'empty';
        }
      }
    }

    const state: PuzzleState = {
      def: {
        size: 10,
        starsPerUnit: 2,
        regions,
      },
      cells,
    };

    console.log('Region 7 cells:');
    const region7Cells: Array<{row: number, col: number, state: string}> = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (regions[r][c] === 7) {
          region7Cells.push({ row: r, col: c, state: cells[r][c] });
          console.log(`  (${r},${c}): ${cells[r][c]}`);
        }
      }
    }

    console.log('\nRow 4 cells:');
    for (let c = 0; c < 10; c++) {
      console.log(`  (4,${c}): region ${regions[4][c]}, state: ${cells[4][c]}`);
    }

    console.log('\nRow 5 cells:');
    for (let c = 0; c < 10; c++) {
      console.log(`  (5,${c}): region ${regions[5][c]}, state: ${cells[5][c]}`);
    }

    console.log('\nRow 6 cells:');
    for (let c = 0; c < 10; c++) {
      console.log(`  (6,${c}): region ${regions[6][c]}, state: ${cells[6][c]}`);
    }

    console.log('\nRow 7 cells:');
    for (let c = 0; c < 10; c++) {
      console.log(`  (7,${c}): region ${regions[7][c]}, state: ${cells[7][c]}`);
    }

    // Check 2x2 blocks in rows 4-7 that intersect with region 7
    console.log('\n2x2 blocks in rows 4-7 that contain region 7 cells:');
    for (let r = 4; r <= 6; r++) {
      for (let c = 0; c < 9; c++) {
        const block = [
          { row: r, col: c },
          { row: r, col: c + 1 },
          { row: r + 1, col: c },
          { row: r + 1, col: c + 1 },
        ];
        
        const hasRegion7 = block.some(cell => regions[cell.row][cell.col] === 7);
        const hasEmpty = block.some(cell => cells[cell.row][cell.col] === 'empty');
        const starCount = block.filter(cell => cells[cell.row][cell.col] === 'star').length;
        
        if (hasRegion7 && hasEmpty && starCount < 1) {
          console.log(`  Block at (${r},${c}):`);
          for (const cell of block) {
            console.log(`    (${cell.row},${cell.col}): region ${regions[cell.row][cell.col]}, state: ${cells[cell.row][cell.col]}`);
          }
        }
      }
    }

    const hint = await findNextHint(state);
    
    if (hint) {
      console.log(`\nFound hint: ${hint.technique}`);
      console.log(`Kind: ${hint.kind}`);
      console.log(`Result cells:`, hint.resultCells);
      console.log(`Explanation: ${hint.explanation}`);
      
      const hasTarget = hint.resultCells.some(c => c.row === 4 && c.col === 7);
      if (hasTarget) {
        console.log('\n✓ Found target cell (4,7)!');
      } else {
        console.log('\n✗ Target cell (4,7) not found in result');
      }
    } else {
      console.log('\n✗ No hint found');
    }

    // The hint should find a star at (4,7)
    expect(hint).not.toBeNull();
    expect(hint?.resultCells).toBeDefined();
    const hasTarget = hint?.resultCells.some(c => c.row === 4 && c.col === 7);
    expect(hasTarget).toBe(true);
  });
});

