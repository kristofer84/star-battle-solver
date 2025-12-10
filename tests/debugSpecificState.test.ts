import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
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
      regionRow.push(regionNum + 1);
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

/**
 * Print puzzle state
 */
function printState(state: PuzzleState): void {
  console.log('\n=== Current State ===');
  for (let r = 0; r < 10; r++) {
    const rowStr = state.cells[r].map((c, i) => {
      const region = state.def.regions[r][i];
      if (c === 'star') return `${region-1}s`;
      if (c === 'cross') return `${region-1}x`;
      return `${region-1}`;
    }).join(' ');
    console.log(`Row ${r}: ${rowStr}`);
  }
}

describe('Debug specific state', () => {
  it('should identify incorrect hint at this state', async () => {
    // Increase timeout
  }, 60000);
    const puzzleStr = `0 0 0 1 1 1x 2s 2x 3 3x
0 0 0 1 1 1x 2x 2x 3 3x
4 4 0 0 1 2 2 2x 2x 3
4 0 0 0 1x 2x 2x 3x 2x 3
4 0 5 0 1 7 7 3x 3 3x
4 0 5 1 1x 7x 3x 3x 9 3x
4 5 5 5 1x 7s 3x 8 9x 3x
4 4 5 5 5x 5x 5x 8 9x 9
4 4x 6 6 6 5x 5x 8 9x 9
6 6 6 5x 5 5x 5x 8 9x 9`;

    const state = parsePuzzle(puzzleStr);
    
    printState(state);
    
    // Validate current state
    const errors = validateState(state);
    if (errors.length > 0) {
      console.log('\n⚠️ Current state has errors:');
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('\n✅ Current state is valid');
    }
    
    // Find next hint
    const hint = await findNextHint(state);
    
    if (!hint) {
      console.log('\n⚠️ No hint found');
      return;
    }
    
    console.log(`\n=== Found Hint ===`);
    console.log(`Technique: ${hint.technique}`);
    console.log(`ID: ${hint.id}`);
    console.log(`Kind: ${hint.kind}`);
    console.log(`Result cells: ${hint.resultCells.map(c => `(${c.row},${c.col})`).join(', ')}`);
    
    // Apply hint
    const testState = JSON.parse(JSON.stringify(state)) as PuzzleState;
    hint.resultCells.forEach(({ row, col }) => {
      let newValue: 'star' | 'cross';
      if (hint.schemaCellTypes) {
        const cellType = hint.schemaCellTypes.get(`${row},${col}`);
        newValue = cellType === 'star' ? 'star' : 'cross';
      } else {
        newValue = hint.kind === 'place-star' ? 'star' : 'cross';
      }
      testState.cells[row][col] = newValue;
    });
    
    console.log('\n=== State After Applying Hint ===');
    printState(testState);
    
    // Validate after applying hint
    const errorsAfter = validateState(testState);
    if (errorsAfter.length > 0) {
      console.log('\n❌ ERROR: Hint creates invalid state!');
      errorsAfter.forEach(err => console.log(`  - ${err}`));
      
      // Check row/column/region star counts
      console.log('\n=== Star counts ===');
      for (let r = 0; r < 10; r++) {
        const stars = testState.cells[r].filter(c => c === 'star').length;
        console.log(`Row ${r}: ${stars} stars (expected 2)`);
      }
      for (let c = 0; c < 10; c++) {
        const stars = testState.cells.map(row => row[c]).filter(c => c === 'star').length;
        console.log(`Col ${c}: ${stars} stars (expected 2)`);
      }
      const regionStars = new Map<number, number>();
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (testState.cells[r][c] === 'star') {
            const regionId = testState.def.regions[r][c];
            regionStars.set(regionId, (regionStars.get(regionId) || 0) + 1);
          }
        }
      }
      console.log('\nRegion star counts:');
      for (let regionId = 1; regionId <= 10; regionId++) {
        const stars = regionStars.get(regionId) || 0;
        console.log(`Region ${regionId-1}: ${stars} stars (expected 2)`);
      }
      
      expect(errorsAfter.length).toBe(0);
    } else {
      console.log('\n✅ State is still valid after applying hint');
      
      // Continue solving to see where it goes wrong
      console.log('\n=== Continuing to solve ===');
      let step = 0;
      const maxSteps = 50;
      let currentState = testState;
      const recentHintIds = new Set<string>(); // Track recent hints to detect loops
      const MAX_REPEATED_HINTS = 3; // If same hint appears 3 times, break
      let cellsChangedCount = 0;
      
      while (step < maxSteps) {
        step++;
        const nextHint = await findNextHint(currentState);
        
        if (!nextHint) {
          console.log(`\nNo more hints at step ${step}`);
          break;
        }
        
        // Check for infinite loop: same hint ID repeated
        if (recentHintIds.has(nextHint.id)) {
          const recentCount = Array.from(recentHintIds).filter(id => id === nextHint.id).length;
          if (recentCount >= MAX_REPEATED_HINTS) {
            console.error(`\n❌ INFINITE LOOP DETECTED: Hint ${nextHint.id} (${nextHint.technique}) has been applied ${recentCount} times`);
            console.error(`Breaking to prevent infinite loop`);
            break;
          }
        }
        recentHintIds.add(nextHint.id);
        // Keep only last 10 hint IDs to avoid memory growth
        if (recentHintIds.size > 10) {
          const oldestId = Array.from(recentHintIds)[0];
          recentHintIds.delete(oldestId);
        }
        
        console.log(`\nStep ${step}: ${nextHint.technique} - ${nextHint.kind}`);
        console.log(`  Cells: ${nextHint.resultCells.map(c => `(${c.row},${c.col})`).join(', ')}`);
        
        // Track cells changed before applying
        const cellsBefore = new Set<string>();
        for (let r = 0; r < currentState.def.size; r++) {
          for (let c = 0; c < currentState.def.size; c++) {
            if (currentState.cells[r][c] !== 'empty') {
              cellsBefore.add(`${r},${c}`);
            }
          }
        }
        
        // Apply hint
        nextHint.resultCells.forEach(({ row, col }) => {
          let newValue: 'star' | 'cross';
          if (nextHint.schemaCellTypes) {
            const cellType = nextHint.schemaCellTypes.get(`${row},${col}`);
            newValue = cellType === 'star' ? 'star' : 'cross';
          } else {
            newValue = nextHint.kind === 'place-star' ? 'star' : 'cross';
          }
          currentState.cells[row][col] = newValue;
        });
        
        // Check if cells actually changed
        const cellsAfter = new Set<string>();
        for (let r = 0; r < currentState.def.size; r++) {
          for (let c = 0; c < currentState.def.size; c++) {
            if (currentState.cells[r][c] !== 'empty') {
              cellsAfter.add(`${r},${c}`);
            }
          }
        }
        
        const actualChanges = cellsAfter.size - cellsBefore.size;
        if (actualChanges === 0) {
          cellsChangedCount++;
          console.warn(`⚠️ Step ${step}: Hint ${nextHint.id} did not change any cells`);
          if (cellsChangedCount >= MAX_REPEATED_HINTS) {
            console.error(`\n❌ NO PROGRESS DETECTED: ${cellsChangedCount} consecutive hints with no cell changes`);
            break;
          }
        } else {
          cellsChangedCount = 0; // Reset counter if progress was made
        }
        
        // Validate
        const errors = validateState(currentState);
        if (errors.length > 0) {
          console.log(`\n❌ ERROR AT STEP ${step}:`);
          errors.forEach(err => console.log(`  - ${err}`));
          printState(currentState);
          expect(errors.length).toBe(0);
          break;
        }
      }
    }
  });
});

