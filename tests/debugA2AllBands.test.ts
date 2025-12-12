import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findBestSchemaApplication } from '../src/logic/schemas/runtime';
import '../src/logic/schemas/index';
import { puzzleStateToBoardState } from '../src/logic/schemas/model/state';
import { enumerateColumnBands, getRegionsIntersectingCols, getRegionBandQuota, getAllCellsOfRegionInBand, allHaveKnownBandQuota } from '../src/logic/schemas/helpers/bandHelpers';
import { regionFullyInsideCols } from '../src/logic/schemas/helpers/groupHelpers';
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

describe('Debug A2 all column bands', () => {
  it('should find which column band A2 uses for incorrect hint', () => {
    const inputPuzzle = `0 0 0 1 1 1x 2s 2x 3 3x
0 0 0 1 1 1x 2x 2x 3 3x
4 4 0 0 1 2 2 2x 2x 3
4 0 0 0 1x 2x 2x 3x 2x 3
4 0 5 0 1 7 7 3x 3 3x
4 0 5 1 1x 7x 3x 3x 9 3x
4 5 5 5 1x 7s 3x 8 9x 3x
4 4 5 5 5x 5x 5x 8 9x 9
4 4x 6 6 6 5x 5x 8 9x 9
6 6 6 5x 5 5x 5x 8 9x 9`;

    const state = parsePuzzle(inputPuzzle);
    const boardState = puzzleStateToBoardState(state);
    
    // Get all A2 applications
    const best = findBestSchemaApplication(state);
    
    console.log('\n=== A2 Applications ===');
    if (best && best.app.schemaId.includes('A2')) {
      console.log(`Found A2 application: ${best.app.schemaId}`);
      const size = state.def.size;
      const stars = best.app.deductions.filter(d => d.type === 'forceStar');
      const crosses = best.app.deductions.filter(d => d.type === 'forceEmpty');
      console.log(`Candidate stars: ${stars.length}`);
      console.log(`Candidate crosses: ${crosses.length}`);

      stars.forEach(d => {
        const row = Math.floor(d.cell / size);
        const col = d.cell % size;
        console.log(`  Star at (${row}, ${col}), region ${state.def.regions[row][col] - 1}`);
      });
      crosses.forEach(d => {
        const row = Math.floor(d.cell / size);
        const col = d.cell % size;
        console.log(`  Cross at (${row}, ${col}), region ${state.def.regions[row][col] - 1}`);
      });
    }
    
    // Check all column bands that contain (4,5) or (5,8)
    const bands = enumerateColumnBands(boardState);
    const relevantBands = bands.filter(b => {
      const cells = b.cells.map(c => ({ row: Math.floor(c / 10), col: c % 10 }));
      const has45 = cells.some(c => c.row === 4 && c.col === 5);
      const has58 = cells.some(c => c.row === 5 && c.col === 8);
      return has45 || has58;
    });
    
    console.log(`\n=== Column Bands containing (4,5) or (5,8) ===`);
    for (const band of relevantBands) {
      console.log(`\nBand columns ${band.cols.join(',')}:`);
      const regions = getRegionsIntersectingCols(boardState, band.cols);
      const fullInside = regions.filter(r => regionFullyInsideCols(r, band.cols, 10));
      const partial = regions.filter(r => !regionFullyInsideCols(r, band.cols, 10));
      
      console.log(`  Full inside: ${fullInside.length}, Partial: ${partial.length}`);
      
      // Check if any partial region would trigger A2
      for (const target of partial) {
        const otherPartial = partial.filter(r => r !== target);
        const allKnown = allHaveKnownBandQuota(otherPartial, band, boardState);
        
        if (allKnown) {
          const starsForcedFullInside = fullInside.reduce((sum, r) => sum + r.starsRequired, 0);
          const starsForcedOtherPartial = otherPartial.reduce((sum, r) => {
            return sum + getRegionBandQuota(r, band, boardState, 0);
          }, 0);
          const starsForcedInC = starsForcedFullInside + starsForcedOtherPartial;
          const colsStarsNeeded = band.cols.length * 2;
          const starsRemainingInC = colsStarsNeeded - starsForcedInC;
          
          const targetCells = getAllCellsOfRegionInBand(target, band, boardState);
          const targetCandidates = targetCells.filter(c => boardState.cellStates[c] === 0);
          
          if (starsRemainingInC === 0 || starsRemainingInC === targetCandidates.length) {
            console.log(`  ⚠️ A2 would apply for region ${target.id-1}:`);
            console.log(`     Stars remaining: ${starsRemainingInC}, Candidates: ${targetCandidates.length}`);
            targetCandidates.forEach(c => {
              const row = Math.floor(c / 10);
              const col = c % 10;
              console.log(`       Candidate at (${row}, ${col})`);
            });
          }
        }
      }
    }
  });
});

