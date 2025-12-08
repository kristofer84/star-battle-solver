/**
 * Partition helper functions for E2 schema
 */

import type { BoardState, Group, CellId, Region } from '../model/types';
import { getCandidatesInGroup } from './groupHelpers';
import { enumerateRowBands, enumerateColumnBands } from './bandHelpers';
import { cellIdToCoord } from '../model/types';

/**
 * Partition of candidate cells
 */
export interface Partition {
  cells: CellId[];
  minRequired?: number; // minimum stars required from this partition
}

/**
 * Partition candidate cells of a group into disjoint subsets
 * Partitions by logical boundaries:
 * - For regions: by row bands and column bands
 * - For rows/columns: by regions
 * - For other groups: by row/column bands
 */
export function partitionCandidates(
  group: Group,
  state: BoardState
): Partition[] {
  const candidates = getCandidatesInGroup(group, state);
  
  if (candidates.length === 0) {
    return [];
  }
  
  const size = state.size;
  
  // For regions: partition by row bands and column bands
  if (group.kind === 'region') {
    return partitionRegionCandidates(group, candidates, state, size);
  }
  
  // For rows: partition by regions
  if (group.kind === 'row') {
    return partitionRowCandidates(group, candidates, state, size);
  }
  
  // For columns: partition by regions
  if (group.kind === 'column') {
    return partitionColumnCandidates(group, candidates, state, size);
  }
  
  // For other groups (bands, blocks): partition by row/column bands
  return partitionByBands(candidates, state, size);
}

/**
 * Partition region candidates by row bands and column bands
 */
function partitionRegionCandidates(
  group: Group,
  candidates: CellId[],
  state: BoardState,
  size: number
): Partition[] {
  // Try partitioning by row bands first
  const rowBands = enumerateRowBands(state);
  const partitionsByRowBand: Map<string, CellId[]> = new Map();
  
  for (const cellId of candidates) {
    const coord = cellIdToCoord(cellId, size);
    // Find the smallest row band containing this cell
    for (const band of rowBands) {
      if (band.rows.includes(coord.row) && band.rows.length <= 3) {
        const key = `rowBand_${band.rows.join(',')}`;
        if (!partitionsByRowBand.has(key)) {
          partitionsByRowBand.set(key, []);
        }
        partitionsByRowBand.get(key)!.push(cellId);
        break;
      }
    }
  }
  
  // If we found meaningful partitions (more than 1), use them
  if (partitionsByRowBand.size > 1) {
    return Array.from(partitionsByRowBand.values()).map(cells => ({ cells }));
  }
  
  // Try column bands
  const colBands = enumerateColumnBands(state);
  const partitionsByColBand: Map<string, CellId[]> = new Map();
  
  for (const cellId of candidates) {
    const coord = cellIdToCoord(cellId, size);
    for (const band of colBands) {
      if (band.cols.includes(coord.col) && band.cols.length <= 3) {
        const key = `colBand_${band.cols.join(',')}`;
        if (!partitionsByColBand.has(key)) {
          partitionsByColBand.set(key, []);
        }
        partitionsByColBand.get(key)!.push(cellId);
        break;
      }
    }
  }
  
  if (partitionsByColBand.size > 1) {
    return Array.from(partitionsByColBand.values()).map(cells => ({ cells }));
  }
  
  // No meaningful partitions found, return single partition
  return [{ cells: candidates }];
}

/**
 * Partition row candidates by regions
 */
function partitionRowCandidates(
  group: Group,
  candidates: CellId[],
  state: BoardState,
  size: number
): Partition[] {
  const partitionsByRegion: Map<number, CellId[]> = new Map();
  
  for (const cellId of candidates) {
    // Find which region this cell belongs to
    for (const region of state.regions) {
      if (region.cells.includes(cellId)) {
        if (!partitionsByRegion.has(region.id)) {
          partitionsByRegion.set(region.id, []);
        }
        partitionsByRegion.get(region.id)!.push(cellId);
        break;
      }
    }
  }
  
  if (partitionsByRegion.size > 1) {
    return Array.from(partitionsByRegion.values()).map(cells => ({ cells }));
  }
  
  return [{ cells: candidates }];
}

/**
 * Partition column candidates by regions
 */
function partitionColumnCandidates(
  group: Group,
  candidates: CellId[],
  state: BoardState,
  size: number
): Partition[] {
  const partitionsByRegion: Map<number, CellId[]> = new Map();
  
  for (const cellId of candidates) {
    for (const region of state.regions) {
      if (region.cells.includes(cellId)) {
        if (!partitionsByRegion.has(region.id)) {
          partitionsByRegion.set(region.id, []);
        }
        partitionsByRegion.get(region.id)!.push(cellId);
        break;
      }
    }
  }
  
  if (partitionsByRegion.size > 1) {
    return Array.from(partitionsByRegion.values()).map(cells => ({ cells }));
  }
  
  return [{ cells: candidates }];
}

/**
 * Partition by row/column bands
 */
function partitionByBands(
  candidates: CellId[],
  state: BoardState,
  size: number
): Partition[] {
  const partitionsByRow: Map<number, CellId[]> = new Map();
  
  for (const cellId of candidates) {
    const coord = cellIdToCoord(cellId, size);
    if (!partitionsByRow.has(coord.row)) {
      partitionsByRow.set(coord.row, []);
    }
    partitionsByRow.get(coord.row)!.push(cellId);
  }
  
  if (partitionsByRow.size > 1) {
    return Array.from(partitionsByRow.values()).map(cells => ({ cells }));
  }
  
  return [{ cells: candidates }];
}

