import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
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

describe('Debug A2 calculation for column 8', () => {
  it('should trace A2 calculation for column 8, region 9', () => {
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
    
    // Focus on column 8 band (single column)
    const bands = enumerateColumnBands(boardState);
    const col8Band = bands.find(b => b.cols.length === 1 && b.cols[0] === 8);
    
    if (!col8Band) {
      throw new Error('Could not find column 8 band');
    }
    
    console.log('\n=== Column 8 Band Analysis ===');
    console.log('Column 8 cells:', col8Band.cells.map(c => {
      const row = Math.floor(c / 10);
      const col = c % 10;
      const region = state.def.regions[row][col];
      const cellState = boardState.cellStates[c];
      const stateStr = cellState === 1 ? 's' : cellState === 2 ? 'x' : '';
      return `${region-1}${stateStr}`;
    }).join(' '));
    
    const regions = getRegionsIntersectingCols(boardState, [8]);
    console.log(`\nRegions intersecting column 8: ${regions.length}`);
    
    const fullInside = regions.filter(r => regionFullyInsideCols(r, [8], 10));
    const partial = regions.filter(r => !regionFullyInsideCols(r, [8], 10));
    
    console.log(`Full inside: ${fullInside.length} regions`);
    fullInside.forEach(r => {
      const cells = getAllCellsOfRegionInBand(r, col8Band, boardState);
      const stars = cells.filter(c => boardState.cellStates[c] === 1).length;
      console.log(`  Region ${r.id-1}: ${stars} stars (required: ${r.starsRequired})`);
    });
    
    console.log(`\nPartial: ${partial.length} regions`);
    partial.forEach(r => {
      const cells = getAllCellsOfRegionInBand(r, col8Band, boardState);
      const stars = cells.filter(c => boardState.cellStates[c] === 1).length;
      const candidates = cells.filter(c => boardState.cellStates[c] === 0).length;
      const quota = getRegionBandQuota(r, col8Band, boardState, 0);
      const isKnown = allHaveKnownBandQuota([r], col8Band, boardState);
      console.log(`  Region ${r.id-1}: ${stars} stars, ${candidates} candidates, quota: ${quota}, known: ${isKnown}`);
    });
    
    // Find region 9 (id = 10, since regions are 1-indexed)
    const region9 = regions.find(r => r.id === 10);
    if (!region9) {
      throw new Error('Could not find region 9');
    }
    
    console.log(`\n=== A2 Calculation for Region 9 (target) ===`);
    const colsStarsNeeded = 1 * 2; // 1 column * 2 stars per column
    console.log(`Stars needed in column 8: ${colsStarsNeeded}`);
    
    const starsForcedFullInside = fullInside.reduce((sum, r) => sum + r.starsRequired, 0);
    console.log(`Stars forced by full inside regions: ${starsForcedFullInside}`);
    
    const otherPartial = partial.filter(r => r.id !== region9.id);
    console.log(`\nOther partial regions: ${otherPartial.length}`);
    
    const allKnown = allHaveKnownBandQuota(otherPartial, col8Band, boardState);
    console.log(`All other partial regions have known quotas: ${allKnown}`);
    
    if (!allKnown) {
      console.log('\n⚠️ A2 should skip this case because not all quotas are known!');
    } else {
      let starsForcedOtherPartial = 0;
      for (const r of otherPartial) {
        const quota = getRegionBandQuota(r, col8Band, boardState, 0);
        const cells = getAllCellsOfRegionInBand(r, col8Band, boardState);
        const stars = cells.filter(c => boardState.cellStates[c] === 1).length;
        const remainingStars = r.starsRequired - r.cells.filter(c => boardState.cellStates[c] === 1).length;
        const candidatesInBand = cells.filter(c => boardState.cellStates[c] === 0).length;
        const allCandidates = r.cells.filter(c => boardState.cellStates[c] === 0).length;
        
        console.log(`  Region ${r.id-1}:`);
        console.log(`    Current stars in band: ${stars}`);
        console.log(`    Remaining stars needed: ${remainingStars}`);
        console.log(`    Candidates in band: ${candidatesInBand}/${allCandidates}`);
        console.log(`    Quota returned: ${quota}`);
        starsForcedOtherPartial += quota;
      }
      
      console.log(`\nStars forced by other partial regions: ${starsForcedOtherPartial}`);
      
      const starsForcedInC = starsForcedFullInside + starsForcedOtherPartial;
      const starsRemainingInC = colsStarsNeeded - starsForcedInC;
      
      console.log(`\nTotal stars forced: ${starsForcedInC}`);
      console.log(`Stars remaining for region 9: ${starsRemainingInC}`);
      
      const region9Cells = getAllCellsOfRegionInBand(region9, col8Band, boardState);
      const region9Candidates = region9Cells.filter(c => boardState.cellStates[c] === 0);
      console.log(`\nRegion 9 candidates in column 8: ${region9Candidates.length}`);
      region9Candidates.forEach(c => {
        const row = Math.floor(c / 10);
        const col = c % 10;
        console.log(`  Candidate at (${row}, ${col})`);
      });
      
      if (starsRemainingInC === 0) {
        console.log(`\n⚠️ A2 would force ALL candidates to be crosses!`);
        console.log(`   But correct solution shows (5, 8) should be a star!`);
      }
    }
  });
});

