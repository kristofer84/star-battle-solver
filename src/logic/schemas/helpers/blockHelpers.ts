/**
 * 2×2 block (cage) helper functions
 */

import type { BoardState, Block2x2, Group, CellId, Region, RowBand, ColumnBand } from '../model/types';
import { CellState } from '../model/types';
import { isStarCandidate } from './cellHelpers';
import { createPlacementValidator } from './placementHelpers';

/**
 * Enumerate all 2×2 blocks in the board
 * (Already done in state construction, but provided for completeness)
 */
export function enumerateBlocks2x2(state: BoardState): Block2x2[] {
  return state.blocks2x2;
}

function getBlockCandidates(block: Block2x2, state: BoardState): CellId[] {
  return block.cells.filter(
    cellId => state.cellStates[cellId] === CellState.Unknown && isStarCandidate(state, cellId)
  );
}

/**
 * Check if two blocks overlap (share at least one cell)
 */
function blocksOverlap(block1: Block2x2, block2: Block2x2): boolean {
  const cells1 = new Set(block1.cells);
  return block2.cells.some(cell => cells1.has(cell));
}

/**
 * Validate a set of star assignments against quotas and adjacency
 */
export function assignmentsAreValid(state: BoardState, assignments: CellId[]): boolean {
  const validator = createPlacementValidator(state);

  for (const cellId of assignments) {
    if (!validator.canPlace(cellId)) {
      return false;
    }
    validator.place(cellId);
  }

  return true;
}

/**
 * Get valid blocks in a band (blocks fully contained in band with at least one candidate)
 */
export function getValidBlocksInBand(
  band: RowBand | ColumnBand,
  state: BoardState
): Block2x2[] {
  const bandCells = new Set(band.cells);

  return state.blocks2x2.filter(block => {
    if (!block.cells.every(cellId => bandCells.has(cellId))) {
      return false;
    }

    if (block.cells.some(cellId => state.cellStates[cellId] === CellState.Star)) {
      return false;
    }

    const candidates = getBlockCandidates(block, state);
    return candidates.length > 0;
  });
}

function hasValidAssignments(
  state: BoardState,
  blockIndices: number[],
  candidateMap: Map<number, CellId[]>
): boolean {
  if (blockIndices.length === 0) {
    return true;
  }

  const validator = createPlacementValidator(state);
  const ordered = [...blockIndices].sort(
    (a, b) => (candidateMap.get(a)?.length || 0) - (candidateMap.get(b)?.length || 0)
  );

  function backtrack(idx: number): boolean {
    if (idx >= ordered.length) {
      return true;
    }

    const blockIdx = ordered[idx];
    const candidates = candidateMap.get(blockIdx) || [];

    for (const cellId of candidates) {
      if (!validator.canPlace(cellId)) {
        continue;
      }
      validator.place(cellId);
      if (backtrack(idx + 1)) {
        return true;
      }
      validator.remove(cellId);
    }

    return false;
  }

  return backtrack(0);
}

/**
 * Find maximum number of non-overlapping blocks from a set
 */
function findMaxNonOverlappingBlocks(blocks: Block2x2[], state: BoardState): Block2x2[] {
  if (blocks.length === 0) return [];
  if (blocks.length === 1) return blocks;

  const candidateMap = new Map<number, CellId[]>();
  blocks.forEach((block, idx) => {
    candidateMap.set(idx, getBlockCandidates(block, state));
  });

  const blocksLength = blocks.length;
  const overlapMatrix: boolean[][] = Array.from({ length: blocksLength }, () => Array(blocksLength).fill(false));
  for (let i = 0; i < blocksLength; i += 1) {
    for (let j = i + 1; j < blocksLength; j += 1) {
      if (blocksOverlap(blocks[i], blocks[j])) {
        overlapMatrix[i][j] = true;
        overlapMatrix[j][i] = true;
      }
    }
  }

  if (blocks.length <= 15) {
    let best: number[] = [];

    function explore(index: number, chosen: number[], usedCells: Set<CellId>): void {
      const remaining = blocksLength - index;
      if (chosen.length + remaining < best.length) {
        return;
      }

      if (index >= blocksLength) {
        if (hasValidAssignments(state, chosen, candidateMap) && chosen.length > best.length) {
          best = [...chosen];
        }
        return;
      }

      // Skip current block
      explore(index + 1, chosen, usedCells);

      // Try including current block if no overlap
      const block = blocks[index];
      if (!block.cells.some(cellId => usedCells.has(cellId))) {
        const nextUsed = new Set(usedCells);
        block.cells.forEach(cellId => nextUsed.add(cellId));
        explore(index + 1, [...chosen, index], nextUsed);
      }
    }

    explore(0, [], new Set());
    return best.map(idx => blocks[idx]);
  }

  const sortedIndices = blocks
    .map((_, idx) => idx)
    .sort((a, b) => (candidateMap.get(a)?.length || 0) - (candidateMap.get(b)?.length || 0));

  const selected: number[] = [];
  const usedCells = new Set<CellId>();

  for (const idx of sortedIndices) {
    const block = blocks[idx];
    if (block.cells.some(cellId => usedCells.has(cellId))) {
      continue;
    }

    const tentative = [...selected, idx];
    if (hasValidAssignments(state, tentative, candidateMap)) {
      selected.push(idx);
      block.cells.forEach(cellId => usedCells.add(cellId));
    }
  }

  return selected.map(idx => blocks[idx]);
}

/**
 * Get maximum number of non-overlapping valid blocks in a band
 */
export function getMaxNonOverlappingBlocksInBand(
  band: RowBand | ColumnBand,
  state: BoardState
): Block2x2[] {
  const allValidBlocks = getValidBlocksInBand(band, state);
  return findMaxNonOverlappingBlocks(allValidBlocks, state);
}

/**
 * Get a set of non-overlapping valid blocks in a band (optionally exact count)
 */
export function getNonOverlappingBlocksInBand(
  band: RowBand | ColumnBand,
  state: BoardState,
  targetCount?: number
): Block2x2[] {
  const allValidBlocks = getValidBlocksInBand(band, state);
  const candidateMap = new Map<number, CellId[]>();
  allValidBlocks.forEach((block, idx) => {
    candidateMap.set(idx, getBlockCandidates(block, state));
  });

  const baseSet = findMaxNonOverlappingBlocks(allValidBlocks, state);
  if (targetCount === undefined || baseSet.length <= targetCount) {
    return baseSet;
  }

  const indices = allValidBlocks.map((_, idx) => idx);
  const size = indices.length;
  let best: number[] | null = null;

  function search(start: number, chosen: number[]): void {
    if (targetCount !== undefined && chosen.length === targetCount) {
      if (hasValidAssignments(state, chosen, candidateMap)) {
        best = [...chosen];
      }
      return;
    }

    if (start >= size || (targetCount !== undefined && chosen.length > targetCount)) {
      return;
    }

    for (let i = start; i < size && best === null; i += 1) {
      const block = allValidBlocks[i];
      if (chosen.some(idx => blocksOverlap(block, allValidBlocks[idx]))) {
        continue;
      }
      search(i + 1, [...chosen, i]);
    }
  }

  if (targetCount !== undefined) {
    search(0, []);
  }

  return best ? best.map(idx => allValidBlocks[idx]) : baseSet;
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
    const allInRegion = block.cells.every(cellId => regionCellSet.has(cellId));
    if (!allInRegion) return false;
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

  const remainingStars = group.starsRequired !== undefined
    ? Math.max(0, group.starsRequired - getStarCountInGroup(group, state))
    : 0;

  if (remainingStars === 0) {
    return 0;
  }

  const candidateCellsInGroup = group.cells.filter(cellId =>
    isStarCandidate(state, cellId)
  );

  if (candidateCellsInGroup.length === 0) {
    return 0;
  }

  const candidateCellsInBlock = candidateCellsInGroup.filter(cellId =>
    blockCellSet.has(cellId)
  );

  if (candidateCellsInBlock.length === 0) {
    return 0;
  }

  if (candidateCellsInBlock.length === candidateCellsInGroup.length) {
    return 1;
  }

  return 0;
}

function getStarCountInGroup(group: Group, state: BoardState): number {
  return group.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
}

function getStarCountInRegion(region: Region, state: BoardState): number {
  return region.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
}
