import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findEntanglementPatternHint } from '../src/logic/techniques/entanglementPatterns';
import { getCell } from '../src/logic/helpers';
import { evaluateFeature } from '../src/logic/entanglements/features';

/**
 * Parse puzzle from user's format
 */
function parsePuzzle(puzzleStr: string): { state: PuzzleState; regions: number[][] } {
  const lines = puzzleStr.trim().split('\n').map(line => line.trim());
  const regions: number[][] = [];
  const stars: [number, number][] = [];
  const crosses: [number, number][] = [];
  
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
      const state = match[2];
      
      regionRow.push(regionNum);
      
      if (state === 's') {
        stars.push([r, c]);
      } else if (state === 'x') {
        crosses.push([r, c]);
      }
    }
    
    regions.push(regionRow);
  }
  
  const state = createEmptyPuzzleState({
    size: 10,
    starsPerUnit: 2,
    regions,
  });
  
  for (const [r, c] of stars) {
    state.cells[r][c] = 'star';
  }
  for (const [r, c] of crosses) {
    state.cells[r][c] = 'cross';
  }
  
  return { state, regions };
}

describe('Debug Exact User Puzzle - Faulty Placement', () => {
  it('should identify the incorrect pattern match', () => {
    const puzzleStr = `0x 0x 0x 0x 0s 1x 1 1 1 1x
2 2x 2s 0x 1x 1x 1 1x 1 3x
2 2x 0x 0x 1 3 3 3 3 3x
4x 4x 0s 4x 3 3 3x 3 3x 8
4x 4x 0x 4x 3x 3 3 7 7x 8
5x 4s 4x 4s 6x 6x 7x 7x 8x 8x
5x 6x 4x 6x 6x 6 6 7 7x 8
5s 6x 6x 6 7 7 7x 7x 8x 8
5x 5x 5x 6 6x 7x 9 9 9 9x
5x 5s 6x 6 9 9 9 9x 9 9x`;

    const { state } = parsePuzzle(puzzleStr);
    
    console.log('\n=== Puzzle State ===');
    console.log('Stars:');
    const starPositions: [number, number][] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (getCell(state, { row: r, col: c }) === 'star') {
          starPositions.push([r, c]);
          console.log(`  (${r}, ${c})`);
        }
      }
    }
    
    console.log('\n=== Testing Pattern Matching ===');
    const hint = findEntanglementPatternHint(state);
    
    if (hint) {
      console.log(`\nFound hint: ${hint.technique}`);
      console.log(`Pattern ID: ${hint.patternId}`);
      console.log(`Kind: ${hint.kind}`);
      console.log(`Result cells: ${hint.resultCells.map(c => `(${c.row},${c.col})`).join(', ')}`);
      console.log(`Explanation: ${hint.explanation}`);
      
      // Check each result cell
      for (const cell of hint.resultCells) {
        console.log(`\n=== Analyzing Candidate (${cell.row},${cell.col}) ===`);
        
        // Check ring 1 definition
        const isRow1 = cell.row === 1;
        const isRow8 = cell.row === 8;
        const isCol1 = cell.col === 1;
        const isCol8 = cell.col === 8;
        const isOnRing1 = isRow1 || isRow8 || isCol1 || isCol8;
        
        // Check actual edge
        const isRow0 = cell.row === 0;
        const isRow9 = cell.row === 9;
        const isCol0 = cell.col === 0;
        const isCol9 = cell.col === 9;
        const isOnEdge = isRow0 || isRow9 || isCol0 || isCol9;
        
        console.log(`  Row: ${cell.row} ${isRow1 ? '(ring 1)' : isRow8 ? '(ring 1)' : isRow0 ? '(actual edge)' : isRow9 ? '(actual edge)' : '(interior)'}`);
        console.log(`  Col: ${cell.col} ${isCol1 ? '(ring 1)' : isCol8 ? '(ring 1)' : isCol0 ? '(actual edge)' : isCol9 ? '(actual edge)' : '(interior)'}`);
        console.log(`  Is on ring 1: ${isOnRing1}`);
        console.log(`  Is on actual edge: ${isOnEdge}`);
        
        // Test the feature evaluation directly
        const featureResult = evaluateFeature('candidate_on_outer_ring', state, cell);
        console.log(`  Feature evaluation result: ${featureResult}`);
        
        if (hint.patternId === '39220f') {
          // This is the constrained rule
          console.log(`  Pattern [39220f] requires candidate_on_outer_ring`);
          
          if (!isOnRing1) {
            console.log(`  ERROR: Candidate is NOT on ring 1 but pattern matched!`);
            console.log(`  This indicates the constraint check is incorrect.`);
          } else if (isOnEdge && !isOnRing1) {
            console.log(`  ERROR: Candidate is on actual edge but NOT on ring 1!`);
          }
          
          // Check if this cell should actually be a star in the solution
          // Based on the completed puzzle provided by the user
          const completedPuzzleStr = `0x 0x 0x 0x 0s 1x 1x 1x 1s 1x
2s 2x 2s 0x 1x 1x 1x 1x 1x 3x
2x 2x 0x 0x 1s 3x 3s 3x 3x 3x
4x 4x 0s 4x 3x 3x 3x 3x 3x 8s
4x 4x 0x 4x 3x 3s 3x 7s 7x 8x
5x 4s 4x 4s 6x 6x 7x 7x 8x 8x
5x 6x 4x 6x 6x 6s 6x 7s 7x 8x
5s 6x 6x 6x 7x 7x 7x 7x 8x 8s
5x 5x 5x 6s 6x 7x 9s 9x 9x 9x
5x 5s 6x 6x 9x 9x 9x 9x 9s 9x`;
          
          const { state: completedState } = parsePuzzle(completedPuzzleStr);
          const completedCellValue = getCell(completedState, cell);
          
          console.log(`  In completed puzzle, this cell is: ${completedCellValue}`);
          
          if (completedCellValue === 'star') {
            console.log(`  ERROR: Pattern suggests placing a cross, but this cell should be a star!`);
            console.log(`  This is the faulty placement the user reported.`);
          }
        }
      }
    } else {
      console.log('\nNo hint found');
    }
  });
});

