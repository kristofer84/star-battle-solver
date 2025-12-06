import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { describeConstraintPair, findSubsetConstraintSqueeze, computeStats } from '../stats';
import { formatRegion, formatRow } from '../helpers';
import { countStars, regionCells } from '../helpers';

let hintCounter = 0;
function nextHintId() {
  hintCounter += 1;
  return `subset-squeeze-${hintCounter}`;
}

/**
 * Explain why a region-band constraint has its specific bounds
 */
function explainRegionBandConstraint(
  state: PuzzleState,
  constraint: { description: string; minStars: number; maxStars: number },
): string | null {
  const regionMatch = constraint.description.match(/Region ([A-J]) rows (\d+)–(\d+)/);
  if (!regionMatch) return null;
  
  const regionLetter = regionMatch[1];
  const regionId = regionLetter.charCodeAt(0) - 64; // A=1, B=2, etc.
  const bandStartRow = parseInt(regionMatch[2], 10);
  const bandEndRow = parseInt(regionMatch[3], 10);
  
  const stats = computeStats(state);
  const regionCells_all = regionCells(state, regionId);
  const placedStars = countStars(state, regionCells_all);
  const regionRemaining = state.def.starsPerUnit - placedStars;
  
  // Check if this constraint was tightened by other bands
  const otherBands = stats.regionBandConstraints.filter((c) => {
    if (c === constraint) return false;
    const otherMatch = c.description.match(/Region ([A-J]) rows (\d+)–(\d+)/);
    if (!otherMatch || otherMatch[1] !== regionLetter) return false;
    if (c.minStars !== c.maxStars || c.minStars <= 0) return false;
    
    const otherStart = parseInt(otherMatch[2], 10);
    const otherEnd = parseInt(otherMatch[3], 10);
    const overlaps = !(bandEndRow < otherStart || bandStartRow > otherEnd);
    return !overlaps;
  });
  
  if (otherBands.length > 0 && constraint.minStars === constraint.maxStars) {
    const starsInOtherBands = otherBands.reduce((sum, band) => sum + band.minStars, 0);
    const otherBandsDesc = otherBands.map(b => b.description.match(/rows (\d+)–(\d+)/)?.[0] || '').join(', ');
    return `Region ${formatRegion(regionId)} needs ${regionRemaining} star${regionRemaining === 1 ? '' : 's'} total, and ${otherBandsDesc} already account${otherBands.length === 1 ? 's' : ''} for ${starsInOtherBands} star${starsInOtherBands === 1 ? '' : 's'}, so this band must have exactly ${constraint.minStars} star${constraint.minStars === 1 ? '' : 's'}`;
  }
  
  return null;
}

/**
 * Explain why a block constraint is forced
 */
function explainBlockConstraint(
  state: PuzzleState,
  constraint: { description: string; minStars: number },
): string | null {
  if (constraint.minStars === 0) return null;
  
  // Check if it's a forced block from row-band counting
  // Format: "2×2 block at rows 3–4, cols 4–5"
  const blockMatch = constraint.description.match(/rows (\d+)–(\d+), cols (\d+)–(\d+)/);
  if (!blockMatch) {
    // Might be "Forced 2×2 block inside Region X rows Y–Z"
    const forcedMatch = constraint.description.match(/Forced 2×2 block inside Region ([A-J]) rows (\d+)–(\d+)/);
    if (forcedMatch) {
      return `This block is forced because all valid placements for the star in ${forcedMatch[0].replace('Forced 2×2 block inside ', '')} fall within this block`;
    }
    return null;
  }
  
  const r = parseInt(blockMatch[1], 10);
  const r1 = parseInt(blockMatch[2], 10);
  const c = parseInt(blockMatch[3], 10);
  const c1 = parseInt(blockMatch[4], 10);
  
  const stats = computeStats(state);
  const rowR = stats.rowConstraints[r];
  const rowR1 = stats.rowConstraints[r1];
  
  // Check if forced by row-band counting with region-band intersection
  // This matches the logic in blockConstraints around line 814-843
  if (rowR && rowR1) {
    const rowBandDemand = (rowR.minStars > 0 ? rowR.minStars : 0) + (rowR1.minStars > 0 ? rowR1.minStars : 0);
    if (rowBandDemand > 0) {
      // Check each region-band that intersects rows r to r+1
      for (const regionBand of stats.regionBandConstraints) {
        if (regionBand.minStars === 1 && regionBand.maxStars === 1) {
          const bandMatch = regionBand.description.match(/Region ([A-J]) rows (\d+)–(\d+)/);
          if (bandMatch) {
            const bandStart = parseInt(bandMatch[2], 10);
            const bandEnd = parseInt(bandMatch[3], 10);
            if (r >= bandStart && r1 <= bandEnd) {
              // Count blocks in rows r to r+1 that have at least 2 empty cells in this region-band
              let blocksWith2PlusEmpties = 0;
              for (let bc = 0; bc < state.def.size - 1; bc += 1) {
                const testBlock: Array<{ row: number; col: number }> = [
                  { row: r, col: bc },
                  { row: r, col: bc + 1 },
                  { row: r1, col: bc },
                  { row: r1, col: bc + 1 },
                ];
                const testBlockSet = new Set(testBlock.map(cell => `${cell.row},${cell.col}`));
                const testBandCellsInBlock = regionBand.cells.filter(c => 
                  testBlockSet.has(`${c.row},${c.col}`) && state.cells[c.row][c.col] === 'empty'
                );
                if (testBandCellsInBlock.length >= 2) {
                  blocksWith2PlusEmpties += 1;
                }
              }
              
              // Check if this specific block has 2+ empty cells in the region-band
              const blockCells: Array<{ row: number; col: number }> = [
                { row: r, col: c },
                { row: r, col: c1 },
                { row: r1, col: c },
                { row: r1, col: c1 },
              ];
              const blockSet = new Set(blockCells.map(cell => `${cell.row},${cell.col}`));
              const bandCellsInBlock = regionBand.cells.filter(c => 
                blockSet.has(`${c.row},${c.col}`) && state.cells[c.row][c.col] === 'empty'
              );
              
              if (rowBandDemand === blocksWith2PlusEmpties && blocksWith2PlusEmpties > 0 && 
                  bandCellsInBlock.length >= 2) {
                return `${formatRow(r)} and ${formatRow(r1)} need ${rowBandDemand} star${rowBandDemand === 1 ? '' : 's'} total, and there are exactly ${blocksWith2PlusEmpties} 2×2 block${blocksWith2PlusEmpties === 1 ? '' : 's'} with at least 2 empty cells in ${regionBand.description}, so each block must contain exactly 1 star`;
              }
            }
          }
        }
      }
    }
  }
  
  return null;
}

export function findSubsetConstraintSqueezeHint(state: PuzzleState, debug = false): Hint | null {
  const result = findSubsetConstraintSqueeze(state, debug);
  if (!result) return null;

  const { small, large, eliminations } = result;
  
  // Build a more detailed explanation
  const explanationParts: string[] = [];
  
  // Get reasons for why constraints have their bounds
  let smallReason = '';
  if (small.source === 'region-band') {
    const reason = explainRegionBandConstraint(state, small);
    if (reason) smallReason = reason;
  } else if (small.source === 'block-forced' || (small.source === 'block' && small.minStars > 0)) {
    const reason = explainBlockConstraint(state, small);
    if (reason) smallReason = reason;
  }
  
  let largeReason = '';
  if (large.source === 'region-band') {
    const reason = explainRegionBandConstraint(state, large);
    if (reason) largeReason = reason;
  }
  
  // Build explanation more concisely
  if (small.minStars === large.maxStars && small.minStars > 0) {
    // Both require exactly the same number of stars
    const reasons: string[] = [];
    if (smallReason) reasons.push(smallReason);
    if (largeReason && largeReason !== smallReason) reasons.push(largeReason);
    
    // Combine the constraint descriptions and reasons more naturally
    if (reasons.length > 0) {
      explanationParts.push(
        `The ${small.description} must contain exactly ${small.minStars} star${small.minStars === 1 ? '' : 's'} (${reasons.join('; ')})`
      );
      explanationParts.push(
        `Since it is completely contained within the ${large.description}, which also requires exactly ${small.minStars} star${small.minStars === 1 ? '' : 's'}, all ${small.minStars} star${small.minStars === 1 ? '' : 's'} must be placed within the ${small.description}`
      );
    } else {
      explanationParts.push(
        `The ${small.description} must contain exactly ${small.minStars} star${small.minStars === 1 ? '' : 's'}, and since it is completely contained within the ${large.description}, which also requires exactly ${small.minStars} star${small.minStars === 1 ? '' : 's'}, all ${small.minStars} star${small.minStars === 1 ? '' : 's'} must be placed within the ${small.description}`
      );
    }
  } else {
    // Different bounds - explain separately
    if (smallReason) {
      explanationParts.push(
        `The ${small.description} must contain exactly ${small.minStars} star${small.minStars === 1 ? '' : 's'} (${smallReason})`
      );
    } else {
      explanationParts.push(
        `The ${small.description} must contain exactly ${small.minStars} star${small.minStars === 1 ? '' : 's'}`
      );
    }
    
    if (largeReason) {
      explanationParts.push(
        `The ${large.description} can contain at most ${large.maxStars} star${large.maxStars === 1 ? '' : 's'} (${largeReason})`
      );
    } else {
      explanationParts.push(
        `The ${large.description} can contain at most ${large.maxStars} star${large.maxStars === 1 ? '' : 's'}`
      );
    }
    
    explanationParts.push(
      `Since the ${small.description} is completely contained within the ${large.description} and both require exactly ${small.minStars} star${small.minStars === 1 ? '' : 's'}, all ${small.minStars} star${small.minStars === 1 ? '' : 's'} must be placed within the ${small.description}`
    );
  }
  
  // List the eliminated cells
  if (eliminations.length > 0) {
    const cellList = eliminations
      .map(c => `row ${c.row + 1}, column ${c.col + 1}`)
      .join(' and ');
    explanationParts.push(
      `The ${eliminations.length} cell${eliminations.length === 1 ? '' : 's'} in the ${large.description} that ${eliminations.length === 1 ? 'is' : 'are'} outside the ${small.description} ${eliminations.length === 1 ? 'cannot' : 'cannot'} contain a star: ${cellList}`
    );
  }
  
  const explanation = `Subset Constraint Squeeze: ${explanationParts.join('. ')}.`;

  return {
    id: nextHintId(),
    kind: 'place-cross',
    technique: 'subset-constraint-squeeze',
    resultCells: eliminations,
    explanation,
    highlights: {
      cells: [...small.cells, ...eliminations],
    },
  };
}

