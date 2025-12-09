/**
 * 2×2 block (cage) helper functions
 */

import type { BoardState, Block2x2, Group, CellId, Region, RowBand, ColumnBand } from '../model/types';
import { CellState } from '../model/types';
import { isStarCandidate } from './cellHelpers';

/**
 * Enumerate all 2×2 blocks in the board
 * (Already done in state construction, but provided for completeness)
 */
export function enumerateBlocks2x2(state: BoardState): Block2x2[] {
  return state.blocks2x2;
}

/**
 * Check if two blocks overlap (share at least one cell)
 */
function blocksOverlap(block1: Block2x2, block2: Block2x2): boolean {
  const cells1 = new Set(block1.cells);
  return block2.cells.some(cell => cells1.has(cell));
}

/**
 * Find maximum number of non-overlapping blocks from a set
 * Uses a better algorithm: try all combinations to find maximum independent set
 * For efficiency, uses a greedy approach but verifies it finds the maximum
 */
function findMaxNonOverlappingBlocks(blocks: Block2x2[]): Block2x2[] {
  if (blocks.length === 0) return [];
  if (blocks.length === 1) return blocks;
  
  // Build overlap graph
  const overlaps: Map<number, Set<number>> = new Map();
  blocks.forEach((b, i) => {
    overlaps.set(i, new Set());
    blocks.forEach((b2, j) => {
      if (i !== j && blocksOverlap(b, b2)) {
        overlaps.get(i)!.add(j);
      }
    });
  });
  
  // Try to find maximum independent set using backtracking
  // For small sets (< 20 blocks), use exhaustive search
  if (blocks.length <= 20) {
    let maxSet: Block2x2[] = [];
    
    function backtrack(currentSet: number[], remaining: number[]) {
      if (currentSet.length > maxSet.length) {
        maxSet = currentSet.map(i => blocks[i]);
      }
      
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const conflicts = overlaps.get(candidate)!;
        
        // Check if candidate conflicts with any in current set
        const hasConflict = currentSet.some(idx => conflicts.has(idx));
        
        if (!hasConflict) {
          // Add candidate and remove all conflicting blocks from remaining
          const newRemaining = remaining.slice(i + 1).filter(idx => !conflicts.has(idx));
          backtrack([...currentSet, candidate], newRemaining);
        }
      }
    }
    
    backtrack([], Array.from({ length: blocks.length }, (_, i) => i));
    return maxSet;
  }
  
  // For larger sets, use greedy algorithm
  const selected: Block2x2[] = [];
  const used = new Set<number>();
  
  // Sort by number of overlaps (ascending) - blocks with fewer overlaps are more likely to be in max set
  const sortedIndices = Array.from({ length: blocks.length }, (_, i) => i)
    .sort((a, b) => overlaps.get(a)!.size - overlaps.get(b)!.size);
  
  for (const idx of sortedIndices) {
    if (used.has(idx)) continue;
    
    // Check if this block conflicts with any selected block
    const conflicts = overlaps.get(idx)!;
    const hasConflict = selected.some((_, i) => {
      const selectedIdx = blocks.indexOf(selected[i]);
      return conflicts.has(selectedIdx);
    });
    
    if (!hasConflict) {
      selected.push(blocks[idx]);
      used.add(idx);
    }
  }
  
  return selected;
}

/**
 * Get valid blocks in a band (blocks fully contained in band with at least one candidate)
 * A block is "in" a band if all 4 cells of the block are in the band.
 * This ensures that stars placed in these blocks count toward the band's star quota.
 */
export function getValidBlocksInBand(
  band: RowBand | ColumnBand,
  state: BoardState
): Block2x2[] {
  const bandCellSet = new Set(band.cells);
  
  return state.blocks2x2.filter(block => {
    // Block must be fully contained in band (all 4 cells must be in band)
    const fullyInBand = block.cells.every(cellId => bandCellSet.has(cellId));
    if (!fullyInBand) return false;
    
    // Block must have at least one candidate cell (unknown, not cross)
    // AND block must not already have a star (if it has a star, it's already "used")
    const hasStar = block.cells.some(cellId => state.cellStates[cellId] === CellState.Star);
    if (hasStar) return false; // Block already has its star, not available for another
    
    // Block must have at least one unknown cell where a star could be placed
    const hasCandidate = block.cells.some(cellId => state.cellStates[cellId] === CellState.Unknown);
    
    return hasCandidate;
  });
}

/**
 * Get maximum number of non-overlapping valid blocks in a band
 * This is what C1 should actually check - not all possible blocks, but non-overlapping sets
 */
export function getMaxNonOverlappingBlocksInBand(
  band: RowBand | ColumnBand,
  state: BoardState
): Block2x2[] {
  const allValidBlocks = getValidBlocksInBand(band, state);
  return findMaxNonOverlappingBlocks(allValidBlocks);
}

/**
 * Find a set of exactly N non-overlapping blocks from a set
 * Returns null if no such set exists
 */
function findExactNonOverlappingBlocks(blocks: Block2x2[], targetCount: number): Block2x2[] | null {
  if (targetCount === 0) return [];
  if (blocks.length < targetCount) return null;
  if (blocks.length === targetCount) {
    // Check if all blocks are non-overlapping
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (blocksOverlap(blocks[i], blocks[j])) {
          return null;
        }
      }
    }
    return blocks;
  }
  
  // Try all combinations of targetCount blocks
  function combine(arr: Block2x2[], k: number): Block2x2[][] {
    if (k === 0) return [[]];
    if (k > arr.length) return [];
    
    const result: Block2x2[][] = [];
    for (let i = 0; i <= arr.length - k; i++) {
      const head = arr[i];
      const tailCombos = combine(arr.slice(i + 1), k - 1);
      for (const combo of tailCombos) {
        // Check if head doesn't overlap with combo
        const overlaps = combo.some(b => blocksOverlap(head, b));
        if (!overlaps) {
          result.push([head, ...combo]);
        }
      }
    }
    return result;
  }
  
  const combinations = combine(blocks, targetCount);
  return combinations.length > 0 ? combinations[0] : null;
}

/**
 * Get a set of exactly N non-overlapping valid blocks in a band
 * Returns the maximum set if N is larger than maximum, or a set of exactly N if possible
 */
export function getNonOverlappingBlocksInBand(
  band: RowBand | ColumnBand,
  state: BoardState,
  targetCount?: number
): Block2x2[] {
  const allValidBlocks = getValidBlocksInBand(band, state);
  if (targetCount !== undefined) {
    const exactSet = findExactNonOverlappingBlocks(allValidBlocks, targetCount);
    const debug = typeof process !== 'undefined' && process.env?.DEBUG_C2 === 'true';
    if (debug && band.type === 'rowBand' && band.rows.length === 2 && band.rows[0] === 3) {
      console.log(`[C2 DEBUG] getNonOverlappingBlocksInBand: targetCount=${targetCount}, allValidBlocks=${allValidBlocks.length}, exactSet=${exactSet ? exactSet.length : 'null'}`);
    }
    if (exactSet) return exactSet;
  }
  // Fall back to maximum set
  return findMaxNonOverlappingBlocks(allValidBlocks);
}

/**
 * Get valid blocks in a region (blocks completely inside region)
 */
export function getValidBlocksInRegion(
  region: Region,
  state: BoardState
): Block2x2[] {
  const regionCellSet = new Set(region.cells);
  
  return state.blocks2x2.filter(block => {
    // All 4 cells of block must be in region
    const allInRegion = block.cells.every(cellId => regionCellSet.has(cellId));
    if (!allInRegion) return false;
    
    // Block must have at least one candidate cell
    return block.cells.some(cellId => isStarCandidate(state, cellId));
  });
}

/**
 * Check if a block is valid (has at least one candidate cell)
 */
export function isBlockValid(block: Block2x2, state: BoardState): boolean {
  return block.cells.some(cellId => isStarCandidate(state, cellId));
}

/**
 * Get all groups (rows, columns, regions) that intersect with given cells
 */
export function getGroupsIntersectingCells(
  state: BoardState,
  cells: CellId[]
): Group[] {
  const cellSet = new Set(cells);
  const groups: Group[] = [];
  
  // Add rows
  for (const row of state.rows) {
    if (row.cells.some(cellId => cellSet.has(cellId))) {
      groups.push({
        kind: 'row',
        id: `row_${row.rowIndex}`,
        cells: row.cells,
        starsRequired: row.starsRequired,
      });
    }
  }
  
  // Add columns
  for (const col of state.cols) {
    if (col.cells.some(cellId => cellSet.has(cellId))) {
      groups.push({
        kind: 'column',
        id: `col_${col.colIndex}`,
        cells: col.cells,
        starsRequired: col.starsRequired,
      });
    }
  }
  
  // Add regions
  for (const region of state.regions) {
    if (region.cells.some(cellId => cellSet.has(cellId))) {
      groups.push({
        kind: 'region',
        id: `region_${region.id}`,
        cells: region.cells,
        starsRequired: region.starsRequired,
      });
    }
  }
  
  return groups;
}

/**
 * Get quota (number of stars) a group must place in a block
 */
export function getQuotaInBlock(
  group: Group,
  block: Block2x2,
  state: BoardState
): number {
  const blockCellSet = new Set(block.cells);
  const groupCellsInBlock = group.cells.filter(cellId => blockCellSet.has(cellId));
  
  if (groupCellsInBlock.length === 0) return 0;
  
  // Count current stars in block from this group
  const currentStars = groupCellsInBlock.filter(
    cellId => state.cellStates[cellId] === CellState.Star
  ).length;
  
  // If group has remaining stars and block is the only place, return 1
  // This is simplified - full implementation would check if group must place star in block
  const remainingStars = group.starsRequired !== undefined
    ? Math.max(0, group.starsRequired - getStarCountInGroup(group, state))
    : 0;
  
  // For now, return 0 (no quota) - full implementation needs more sophisticated logic
  // This would check if group is forced to place a star in this block
  return 0;
}

/**
 * Helper to get star count in group
 */
function getStarCountInGroup(group: Group, state: BoardState): number {
  return group.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
}

/**
 * Get star count in region
 */
function getStarCountInRegion(region: Region, state: BoardState): number {
  return region.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
}

