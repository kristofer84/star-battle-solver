import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import type { PuzzleState } from '../src/types/puzzle';

/**
 * Parse puzzle from string format
 */
function parsePuzzle(puzzleStr: string): PuzzleState {
  const lines = puzzleStr.trim().split('\n').map(line => line.trim());
  const regions: number[][] = [];
  
  for (let r = 0; r < 10; r++) {
    const line = lines[r];
    const cells = line.split(/\s+/);
    const regionRow: number[] = [];
    
    for (let c = 0; c < 10; c++) {
      const cell = cells[c];
      const match = cell.match(/^(\d+)([xs]?)$/);
      if (!match) {
        throw new Error(`Invalid cell format at row ${r}, col ${c}: ${cell}`);
      }
      
      const regionNum = parseInt(match[1], 10);
      regionRow.push(regionNum);
    }
    
    regions.push(regionRow);
  }
  
  const state = createEmptyPuzzleState({
    size: 10,
    starsPerUnit: 2,
    regions,
  });
  
  for (let r = 0; r < 10; r++) {
    const line = lines[r];
    const cells = line.split(/\s+/);
    
    for (let c = 0; c < 10; c++) {
      const cell = cells[c];
      const match = cell.match(/^(\d+)([xs]?)$/);
      if (!match) continue;
      
      const stateChar = match[2];
      if (stateChar === 's') {
        state.cells[r][c] = 'star';
      } else if (stateChar === 'x') {
        state.cells[r][c] = 'cross';
      }
    }
  }
  
  return state;
}

describe('Debug wrong hint at specific state', () => {
  it('should identify incorrect hint', async () => {
    const currentStateStr = `0 0 0 1 1 1x 2s 2x 3 3x
0 0 0 1 1 1x 2x 2x 3 3x
4 4 0 0 1 2 2 2x 2x 3
4 0 0 0 1x 2x 2x 3x 2x 3
4 0 5 0 1 7 7 3x 3 3x
4 0 5 1 1x 7x 3x 3x 9 3x
4 5 5 5 1x 7s 3x 8 9x 3x
4 4 5 5 5x 5x 5x 8 9x 9
4 4x 6 6 6 5x 5x 8 9x 9
6 6 6 5x 5 5x 5x 8 9x 9`;

    const correctSolutionStr = `0x 0x 0x 1s 1x 1x 2s 2x 3x 3x
0x 0s 0x 1x 1x 1x 2x 2x 3s 3x
4x 4x 0x 0s 1x 2s 2x 2x 2x 3x
4s 0x 0x 0x 1x 2x 2x 3x 2x 3s
4x 0x 5x 0x 1s 7x 7s 3x 3x 3x
4x 0x 5s 1x 1x 7x 3x 3x 9s 3x
4s 5x 5x 5x 1x 7s 3x 8x 9x 3x
4x 4x 5s 5x 5x 5x 5x 8s 9x 9x
4x 4x 6x 6x 6s 5x 5x 8x 9x 9s
6x 6s 6x 5x 5x 5x 5x 8s 9x 9x`;

    const currentState = parsePuzzle(currentStateStr);
    const correctSolution = parsePuzzle(correctSolutionStr);
    
    console.log('\n=== Current State ===');
    for (let r = 0; r < 10; r++) {
      const rowStr = currentState.cells[r].map((c, i) => {
        const region = currentState.def.regions[r][i];
        if (c === 'star') return `${region-1}s`;
        if (c === 'cross') return `${region-1}x`;
        return `${region-1}`;
      }).join(' ');
      console.log(`Row ${r}: ${rowStr}`);
    }
    
    console.log('\n=== Correct Solution ===');
    for (let r = 0; r < 10; r++) {
      const rowStr = correctSolution.cells[r].map((c, i) => {
        const region = correctSolution.def.regions[r][i];
        if (c === 'star') return `${region-1}s`;
        if (c === 'cross') return `${region-1}x`;
        return `${region-1}`;
      }).join(' ');
      console.log(`Row ${r}: ${rowStr}`);
    }
    
    // Find differences
    console.log('\n=== Differences ===');
    const differences: Array<{ row: number; col: number; current: string; correct: string }> = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const current = currentState.cells[r][c];
        const correct = correctSolution.cells[r][c];
        if (current !== correct) {
          differences.push({ row: r, col: c, current, correct });
          const region = currentState.def.regions[r][c];
          console.log(`(${r},${c}) region ${region-1}: current=${current}, correct=${correct}`);
        }
      }
    }
    
    // Find next hint
    const hint = await findNextHint(currentState);
    
    if (!hint) {
      console.log('\n⚠️ No hint found');
      return;
    }
    
    console.log(`\n=== Found Hint ===`);
    console.log(`Technique: ${hint.technique}`);
    console.log(`ID: ${hint.id}`);
    console.log(`Kind: ${hint.kind}`);
    console.log(`Result cells: ${hint.resultCells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    
    // Check if hint conflicts with correct solution
    console.log('\n=== Hint vs Correct Solution ===');
    for (const cell of hint.resultCells) {
      const correctValue = correctSolution.cells[cell.row][cell.col];
      const hintValue = hint.kind === 'place-star' ? 'star' : 'cross';
      
      if (hint.schemaCellTypes) {
        const cellType = hint.schemaCellTypes.get(`${cell.row},${cell.col}`);
        const actualHintValue = cellType === 'star' ? 'star' : 'cross';
        if (actualHintValue !== correctValue) {
          console.log(`❌ WRONG: Hint places ${actualHintValue} at (${cell.row},${cell.col}), but correct solution has ${correctValue}`);
        } else {
          console.log(`✅ Correct: Hint places ${actualHintValue} at (${cell.row},${cell.col})`);
        }
      } else {
        if (hintValue !== correctValue) {
          console.log(`❌ WRONG: Hint places ${hintValue} at (${cell.row},${cell.col}), but correct solution has ${correctValue}`);
        } else {
          console.log(`✅ Correct: Hint places ${hintValue} at (${cell.row},${cell.col})`);
        }
      }
    }
  }, 60000);
});

