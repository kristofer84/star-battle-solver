import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
// Ensure schemas are registered
import '../src/logic/schemas/index';
import { puzzleStateToBoardState } from '../src/logic/schemas/model/state';
import { enumerateRowBands, getRegionsIntersectingRows, getRegionBandQuota, getAllCellsOfRegionInBand } from '../src/logic/schemas/helpers/bandHelpers';
import { regionFullyInsideRows } from '../src/logic/schemas/helpers/groupHelpers';
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

describe('Debug A1 calculation for faulty star', () => {
  it('should trace A1 calculation for row 0, region 3', () => {
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
    
    // Focus on row 0 band (single row)
    const bands = enumerateRowBands(boardState);
    const row0Band = bands.find(b => b.rows.length === 1 && b.rows[0] === 0);
    
    if (!row0Band) {
      throw new Error('Could not find row 0 band');
    }
    
    console.log('\n=== Row 0 Band Analysis ===');
    console.log('Row 0 cells:', row0Band.cells.map(c => {
      const row = Math.floor(c / 10);
      const col = c % 10;
      const region = state.def.regions[row][col];
      const cellState = boardState.cellStates[c];
      const stateStr = cellState === 1 ? 's' : cellState === 2 ? 'x' : '';
      return `${region-1}${stateStr}`;
    }).join(' '));
    
    const regions = getRegionsIntersectingRows(boardState, [0]);
    console.log(`\nRegions intersecting row 0: ${regions.length}`);
    
    const fullInside = regions.filter(r => regionFullyInsideRows(r, [0], 10));
    const partial = regions.filter(r => !regionFullyInsideRows(r, [0], 10));
    
    console.log(`Full inside: ${fullInside.length} regions`);
    fullInside.forEach(r => {
      const cells = getAllCellsOfRegionInBand(r, row0Band, boardState);
      const stars = cells.filter(c => boardState.cellStates[c] === 1).length;
      console.log(`  Region ${r.id-1}: ${stars} stars (required: ${r.starsRequired})`);
    });
    
    console.log(`\nPartial: ${partial.length} regions`);
    partial.forEach(r => {
      const cells = getAllCellsOfRegionInBand(r, row0Band, boardState);
      const stars = cells.filter(c => boardState.cellStates[c] === 1).length;
      const candidates = cells.filter(c => boardState.cellStates[c] === 0).length;
      const quota = getRegionBandQuota(r, row0Band, boardState, 0);
      console.log(`  Region ${r.id-1}: ${stars} stars, ${candidates} candidates, quota: ${quota}`);
    });
    
    // Find region 3 (id = 4, since regions are 1-indexed)
    const region3 = regions.find(r => r.id === 4);
    if (!region3) {
      throw new Error('Could not find region 3');
    }
    
    console.log(`\n=== A1 Calculation for Region 3 (target) ===`);
    const rowsStarsNeeded = 1 * 2; // 1 row * 2 stars per row
    console.log(`Stars needed in row 0: ${rowsStarsNeeded}`);
    
    const starsForcedFullInside = fullInside.reduce((sum, r) => sum + r.starsRequired, 0);
    console.log(`Stars forced by full inside regions: ${starsForcedFullInside}`);
    
    const otherPartial = partial.filter(r => r.id !== region3.id);
    console.log(`\nOther partial regions: ${otherPartial.length}`);
    
    let starsForcedOtherPartial = 0;
    for (const r of otherPartial) {
      const quota = getRegionBandQuota(r, row0Band, boardState, 0);
      const cells = getAllCellsOfRegionInBand(r, row0Band, boardState);
      const stars = cells.filter(c => boardState.cellStates[c] === 1).length;
      const remainingStars = r.starsRequired - r.cells.filter(c => boardState.cellStates[c] === 1).length;
      const candidatesInBand = cells.filter(c => boardState.cellStates[c] === 0).length;
      const allCandidates = r.cells.filter(c => boardState.cellStates[c] === 0).length;
      
      console.log(`  Region ${r.id-1}:`);
      console.log(`    Current stars in band: ${stars}`);
      console.log(`    Remaining stars needed: ${remainingStars}`);
      console.log(`    Candidates in band: ${candidatesInBand}/${allCandidates}`);
      console.log(`    Quota returned: ${quota}`);
      
      if (quota === 0) {
        if (candidatesInBand === allCandidates && remainingStars > 0) {
          const forced = stars + remainingStars;
          console.log(`    → Using: ${forced} (all candidates in band)`);
          starsForcedOtherPartial += forced;
        } else {
          console.log(`    → Using: ${stars} (conservative)`);
          starsForcedOtherPartial += stars;
        }
      } else {
        console.log(`    → Using quota: ${quota}`);
        starsForcedOtherPartial += quota;
      }
    }
    
    console.log(`\nStars forced by other partial regions: ${starsForcedOtherPartial}`);
    
    const starsForcedInR = starsForcedFullInside + starsForcedOtherPartial;
    const starsRemainingInR = rowsStarsNeeded - starsForcedInR;
    
    console.log(`\nTotal stars forced: ${starsForcedInR}`);
    console.log(`Stars remaining for region 3: ${starsRemainingInR}`);
    
    const region3Cells = getAllCellsOfRegionInBand(region3, row0Band, boardState);
    const region3Candidates = region3Cells.filter(c => boardState.cellStates[c] === 0);
    console.log(`\nRegion 3 candidates in row 0: ${region3Candidates.length}`);
    region3Candidates.forEach(c => {
      const row = Math.floor(c / 10);
      const col = c % 10;
      console.log(`  Candidate at (${row}, ${col})`);
    });
    
    if (starsRemainingInR === region3Candidates.length) {
      console.log(`\n⚠️ A1 would force ALL candidates to be stars!`);
      console.log(`   But expected solution shows (0, 8) should be a cross!`);
    }
  });
});

