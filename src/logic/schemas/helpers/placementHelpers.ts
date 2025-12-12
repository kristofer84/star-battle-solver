import type { BoardState, CellId } from '../model/types';
import { CellState, cellIdToCoord } from '../model/types';
import { areAdjacent } from './cellHelpers';

export interface PlacementContext {
  regionByCell: number[];
  rowCounts: number[];
  colCounts: number[];
  regionCounts: Map<number, number>;
  existingStars: Set<CellId>;
}

const regionByCellCache = new WeakMap<BoardState, number[]>();

function getRegionByCell(state: BoardState): number[] {
  const cached = regionByCellCache.get(state);
  if (cached) {
    return cached;
  }

  const regionByCell: number[] = new Array(state.size * state.size).fill(-1);
  state.regions.forEach(region => {
    region.cells.forEach(cellId => {
      regionByCell[cellId] = region.id;
    });
  });

  regionByCellCache.set(state, regionByCell);
  return regionByCell;
}

export function buildPlacementContext(state: BoardState): PlacementContext {
  const { size, starsPerLine, starsPerRegion } = state;
  const regionByCell = getRegionByCell(state);
  const rowCounts = new Array(size).fill(0);
  const colCounts = new Array(size).fill(0);
  const regionCounts = new Map<number, number>();
  const existingStars: Set<CellId> = new Set();

  state.cellStates.forEach((cellState, cellId) => {
    if (cellState !== CellState.Star) {
      return;
    }
    existingStars.add(cellId);
    const { row, col } = cellIdToCoord(cellId, size);
    rowCounts[row] += 1;
    colCounts[col] += 1;
    const regionId = regionByCell[cellId];
    regionCounts.set(regionId, (regionCounts.get(regionId) || 0) + 1);
  });

  for (let i = 0; i < size; i += 1) {
    rowCounts[i] = Math.min(rowCounts[i], starsPerLine);
    colCounts[i] = Math.min(colCounts[i], starsPerLine);
  }

  state.regions.forEach(region => {
    const current = regionCounts.get(region.id) || 0;
    regionCounts.set(region.id, Math.min(current, starsPerRegion));
  });

  return {
    regionByCell,
    rowCounts,
    colCounts,
    regionCounts,
    existingStars,
  };
}

export function createPlacementValidator(state: BoardState) {
  const { size, starsPerLine, starsPerRegion } = state;
  const placementCtx = buildPlacementContext(state);
  const placements: Set<CellId> = new Set();

  function canPlace(cellId: CellId): boolean {
    if (state.cellStates[cellId] === CellState.Empty) {
      return false;
    }

    const { row, col } = cellIdToCoord(cellId, size);
    const regionId = placementCtx.regionByCell[cellId];

    if (placementCtx.rowCounts[row] + 1 > starsPerLine) return false;
    if (placementCtx.colCounts[col] + 1 > starsPerLine) return false;
    if ((placementCtx.regionCounts.get(regionId) || 0) + 1 > starsPerRegion) return false;

    for (const existing of placementCtx.existingStars) {
      if (areAdjacent(existing, cellId, size)) {
        return false;
      }
    }

    for (const placed of placements) {
      if (areAdjacent(placed, cellId, size)) {
        return false;
      }
    }

    return true;
  }

  function place(cellId: CellId): void {
    const { row, col } = cellIdToCoord(cellId, size);
    const regionId = placementCtx.regionByCell[cellId];
    placementCtx.rowCounts[row] += 1;
    placementCtx.colCounts[col] += 1;
    placementCtx.regionCounts.set(regionId, (placementCtx.regionCounts.get(regionId) || 0) + 1);
    placements.add(cellId);
  }

  function remove(cellId: CellId): void {
    const { row, col } = cellIdToCoord(cellId, size);
    const regionId = placementCtx.regionByCell[cellId];
    placementCtx.rowCounts[row] -= 1;
    placementCtx.colCounts[col] -= 1;
    placementCtx.regionCounts.set(regionId, (placementCtx.regionCounts.get(regionId) || 0) - 1);
    placements.delete(cellId);
  }

  return { canPlace, place, remove };
}

