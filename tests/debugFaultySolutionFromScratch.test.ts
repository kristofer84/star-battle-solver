import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
import type { PuzzleState } from '../src/types/puzzle';

/**
 * Parse puzzle regions from string format
 */
function parsePuzzleRegions(puzzleStr: string): PuzzleState {
  const lines = puzzleStr.trim().split('\n').map(line => line.trim());
  const regions: number[][] = [];
  
  for (let r = 0; r < 10; r++) {
    const line = lines[r];
    const cells = line.split(/\s+/);
    const regionRow: number[] = [];
    
    for (let c = 0; c < 10; c++) {
      const cell = cells[c];
      const regionNum = parseInt(cell, 10);
      // Convert region from 0-9 to 1-10
      regionRow.push(regionNum + 1);
    }
    
    regions.push(regionRow);
  }
  
  const state = createEmptyPuzzleState({
    size: 10,
    starsPerUnit: 2,
    regions,
  });
  
  return state;
}

/**
 * Print puzzle state in readable format
 */
function printState(state: PuzzleState, step: number): void {
  console.log(`\n=== Step ${step} ===`);
  for (let r = 0; r < 10; r++) {
    const rowStr = state.cells[r].map((c, i) => {
      const region = state.def.regions[r][i];
      if (c === 'star') return `${region-1}s`;
      if (c === 'cross') return `${region-1}x`;
      return `${region-1}`;
    }).join(' ');
    console.log(`Row ${r}: ${rowStr}`);
  }
  
  const errors = validateState(state);
  if (errors.length > 0) {
    console.log(`\n⚠️ VALIDATION ERRORS:`);
    errors.forEach(err => console.log(`  - ${err}`));
  }
}

describe('Debug faulty solution from scratch', () => {
  it('should identify where solver makes incorrect move', async () => {
    // Increase timeout for this long-running test
    const puzzleRegions = `0 0 0 1 1 1 2 2 3 3
0 0 0 1 1 1 2 2 3 3
4 4 0 0 1 2 2 2 2 3
4 0 0 0 1 2 2 3 2 3
4 0 5 0 1 7 7 3 3 3
4 0 5 1 1 7 3 3 9 3
4 5 5 5 1 7 3 8 9 3
4 4 5 5 5 5 5 8 9 9
4 4 6 6 6 5 5 8 9 9
6 6 6 5 5 5 5 8 9 9`;

    const state = parsePuzzleRegions(puzzleRegions);
    
    console.log('\n=== Starting from empty board ===');
    printState(state, 0);
    
    let step = 0;
    const maxSteps = 200; // Increase to catch more steps
    const appliedHints: Array<{ step: number; hint: any; cellsChanged: string[] }> = [];
    
    while (step < maxSteps) {
      step++;
      
      const hint = await findNextHint(state);
      
      if (!hint) {
        console.log(`\n=== No more hints at step ${step} ===`);
        printState(state, step);
        
        // Check if puzzle is complete
        const allFilled = state.cells.every(row => 
          row.every(cell => cell !== 'empty')
        );
        
        if (allFilled) {
          console.log('\n✅ Puzzle is complete!');
          
          // Validate final state
          const errors = validateState(state);
          if (errors.length > 0) {
            console.log(`\n❌ FINAL STATE HAS ERRORS:`);
            errors.forEach(err => console.log(`  - ${err}`));
            
            // Check row/column/region star counts
            console.log('\n=== Star counts ===');
            for (let r = 0; r < 10; r++) {
              const stars = state.cells[r].filter(c => c === 'star').length;
              console.log(`Row ${r}: ${stars} stars (expected 2)`);
            }
            for (let c = 0; c < 10; c++) {
              const stars = state.cells.map(row => row[c]).filter(c => c === 'star').length;
              console.log(`Col ${c}: ${stars} stars (expected 2)`);
            }
            const regionStars = new Map<number, number>();
            for (let r = 0; r < 10; r++) {
              for (let c = 0; c < 10; c++) {
                if (state.cells[r][c] === 'star') {
                  const regionId = state.def.regions[r][c];
                  regionStars.set(regionId, (regionStars.get(regionId) || 0) + 1);
                }
              }
            }
            console.log('\nRegion star counts:');
            for (let regionId = 1; regionId <= 10; regionId++) {
              const stars = regionStars.get(regionId) || 0;
              console.log(`Region ${regionId-1}: ${stars} stars (expected 2)`);
            }
          } else {
            console.log('\n⚠️ Puzzle is incomplete but no more hints available');
          }
        } else {
          console.log('\n⚠️ Puzzle is incomplete');
        }
        break;
      }
      
      // Apply hint
      const cellsChanged: string[] = [];
      if (!hint.resultCells || hint.resultCells.length === 0) {
        console.log(`⚠️ Hint has no resultCells, skipping`);
        console.log(`Hint object:`, JSON.stringify(hint, null, 2));
        continue;
      }
      
      hint.resultCells.forEach(({ row, col }) => {
        const oldValue = state.cells[row][col];
        // For schema-based hints with mixed types, use schemaCellTypes
        let newValue: 'star' | 'cross';
        if (hint.schemaCellTypes) {
          const cellType = hint.schemaCellTypes.get(`${row},${col}`);
          newValue = cellType === 'star' ? 'star' : 'cross';
        } else {
          newValue = hint.kind === 'place-star' ? 'star' : 'cross';
        }
        
        if (oldValue !== newValue) {
          state.cells[row][col] = newValue;
          cellsChanged.push(`(${row},${col}): ${oldValue}→${newValue}`);
        }
      });
      
      appliedHints.push({
        step,
        hint: {
          technique: hint.technique,
          id: hint.id,
          kind: hint.kind,
        },
        cellsChanged,
      });
      
      console.log(`\n=== Step ${step}: ${hint.technique} ===`);
      console.log(`Hint ID: ${hint.id}`);
      console.log(`Kind: ${hint.kind}`);
      console.log(`Result cells: ${hint.resultCells ? hint.resultCells.length : 'undefined'}`);
      if (hint.resultCells) {
        console.log(`Cells: ${hint.resultCells.map(c => `(${c.row},${c.col})`).join(', ')}`);
      }
      console.log(`Cells changed: ${cellsChanged.join(', ')}`);
      
      // Validate after each step
      const errors = validateState(state);
      if (errors.length > 0) {
        console.log(`\n❌ ERROR AT STEP ${step}:`);
        errors.forEach(err => console.log(`  - ${err}`));
        printState(state, step);
        
        // Show history of applied hints
        console.log('\n=== Applied Hints History ===');
        appliedHints.forEach(({ step: s, hint: h, cellsChanged: cc }) => {
          console.log(`Step ${s}: ${h.technique} (${h.kind}) - ${cc.join(', ')}`);
        });
        
        expect(errors.length).toBe(0);
        break;
      }
      
      // Print state every 5 steps or if we're getting close to completion
      if (step % 5 === 0 || step > 50) {
        printState(state, step);
      }
    }
    
    if (step >= maxSteps) {
      console.log(`\n⚠️ Reached max steps (${maxSteps})`);
      printState(state, step);
    }
  }, 60000); // 60 second timeout for this long-running test
});

