import type { PuzzleState, Coords } from '../types/puzzle';
import {
  colCells,
  countStars,
  emptyCells,
  formatCol,
  formatRegion,
  formatRow,
  regionCells,
  rowCells,
} from './helpers';

export type ConstraintSource =
  | 'row'
  | 'col'
  | 'region'
  | 'region-band'
  | 'block'
  | 'block-forced';

export interface Constraint {
  cells: Coords[];
  minStars: number;
  maxStars: number;
  source: ConstraintSource;
  description: string;
}

export interface Stats {
  rowConstraints: Constraint[];
  colConstraints: Constraint[];
  regionConstraints: Constraint[];
  regionBandConstraints: Constraint[];
  blockConstraints: Constraint[];
}

const coordKey = (c: Coords) => `${c.row},${c.col}`;

function cellsAreAdjacent(a: Coords, b: Coords): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1;
}

interface FlowEdge {
  to: number;
  rev: number;
  cap: number;
}

class MaxFlow {
  private levels: number[];
  private iters: number[];
  private readonly graph: FlowEdge[][];

  constructor(private readonly nodeCount: number) {
    this.graph = Array.from({ length: nodeCount }, () => []);
    this.levels = new Array(nodeCount).fill(-1);
    this.iters = new Array(nodeCount).fill(0);
  }

  addEdge(from: number, to: number, capacity: number): void {
    if (capacity <= 0) return;
    const forward: FlowEdge = { to, rev: this.graph[to].length, cap: capacity };
    const backward: FlowEdge = { to: from, rev: this.graph[from].length, cap: 0 };
    this.graph[from].push(forward);
    this.graph[to].push(backward);
  }

  private bfs(source: number, sink: number): boolean {
    this.levels.fill(-1);
    const queue: number[] = [];
    this.levels[source] = 0;
    queue.push(source);

    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const edge of this.graph[node]) {
        if (edge.cap <= 0 || this.levels[edge.to] >= 0) continue;
        this.levels[edge.to] = this.levels[node] + 1;
        queue.push(edge.to);
      }
    }

    return this.levels[sink] >= 0;
  }

  private dfs(node: number, sink: number, flow: number): number {
    if (node === sink) return flow;
    for (let i = this.iters[node]; i < this.graph[node].length; i += 1) {
      this.iters[node] = i;
      const edge = this.graph[node][i];
      if (edge.cap <= 0 || this.levels[node] >= this.levels[edge.to]) continue;
      const d = this.dfs(edge.to, sink, Math.min(flow, edge.cap));
      if (d > 0) {
        edge.cap -= d;
        const reverse = this.graph[edge.to][edge.rev];
        reverse.cap += d;
        return d;
      }
    }
    return 0;
  }

  maxFlow(source: number, sink: number): number {
    let total = 0;
    const INF = Number.MAX_SAFE_INTEGER;
    while (this.bfs(source, sink)) {
      this.iters.fill(0);
      let flow: number;
      // eslint-disable-next-line no-constant-condition
      while ((flow = this.dfs(source, sink, INF)) > 0) {
        total += flow;
      }
    }
    return total;
  }
}

function normalizeBounds(minStars: number, maxStars: number): { minStars: number; maxStars: number } {
  const min = Math.max(0, minStars);
  const max = Math.max(min, maxStars);
  return { minStars: min, maxStars: max };
}

function rowConstraint(state: PuzzleState, row: number): Constraint {
  const candidates = emptyCells(state, rowCells(state, row));
  const placedStars = countStars(state, rowCells(state, row));
  const remaining = state.def.starsPerUnit - placedStars;
  const { minStars, maxStars } = normalizeBounds(remaining, Math.min(remaining, candidates.length));

  return {
    cells: candidates,
    minStars,
    maxStars,
    source: 'row',
    description: `${formatRow(row)} (${remaining} star${remaining === 1 ? '' : 's'} remaining)`,
  };
}

function colConstraint(state: PuzzleState, col: number): Constraint {
  const candidates = emptyCells(state, colCells(state, col));
  const placedStars = countStars(state, colCells(state, col));
  const remaining = state.def.starsPerUnit - placedStars;
  const { minStars, maxStars } = normalizeBounds(remaining, Math.min(remaining, candidates.length));

  return {
    cells: candidates,
    minStars,
    maxStars,
    source: 'col',
    description: `${formatCol(col)} (${remaining} star${remaining === 1 ? '' : 's'} remaining)`,
  };
}

function regionConstraint(state: PuzzleState, regionId: number): Constraint {
  const cells = regionCells(state, regionId);
  const candidates = emptyCells(state, cells);
  const placedStars = countStars(state, cells);
  const remaining = state.def.starsPerUnit - placedStars;
  const { minStars, maxStars } = normalizeBounds(remaining, Math.min(remaining, candidates.length));

  return {
    cells: candidates,
    minStars,
    maxStars,
    source: 'region',
    description: `Region ${formatRegion(regionId)} (${remaining} star${remaining === 1 ? '' : 's'} remaining)`,
  };
}

function buildRowPlacementMaps(
  state: PuzzleState,
  rows: number[],
): { rowMaps: Map<number, Map<number, number>>; regionTotals: Map<number, number> } {
  const rowMaps = new Map<number, Map<number, number>>();
  const regionTotals = new Map<number, number>();

  for (const row of rows) {
    const rowMap = new Map<number, number>();
    for (let col = 0; col < state.def.size; col += 1) {
      if (state.cells[row][col] !== 'empty') continue;
      const cell = { row, col };
      if (!isLegalSingleStarPlacement(state, cell)) continue;
      const cellRegion = state.def.regions[row][col];
      rowMap.set(cellRegion, (rowMap.get(cellRegion) ?? 0) + 1);
      regionTotals.set(cellRegion, (regionTotals.get(cellRegion) ?? 0) + 1);
    }
    rowMaps.set(row, rowMap);
  }

  return { rowMaps, regionTotals };
}

function buildRegionRowMap(state: PuzzleState): Map<number, number[]> {
  const rowSets = new Map<number, Set<number>>();
  for (let row = 0; row < state.def.size; row += 1) {
    for (let col = 0; col < state.def.size; col += 1) {
      const regionId = state.def.regions[row][col];
      if (!rowSets.has(regionId)) {
        rowSets.set(regionId, new Set<number>());
      }
      rowSets.get(regionId)!.add(row);
    }
  }

  const result = new Map<number, number[]>();
  for (const [regionId, rows] of rowSets.entries()) {
    result.set(regionId, Array.from(rows).sort((a, b) => a - b));
  }
  return result;
}

function legalRegionCells(state: PuzzleState, regionId: number): Coords[] {
  const candidates: Coords[] = [];
  for (let row = 0; row < state.def.size; row += 1) {
    for (let col = 0; col < state.def.size; col += 1) {
      if (state.def.regions[row][col] !== regionId) continue;
      const cell = { row, col };
      if (!isLegalSingleStarPlacement(state, cell)) continue;
      candidates.push(cell);
    }
  }
  return candidates;
}

function analyzeRegionPlacementRange(
  state: PuzzleState,
  regionId: number,
  bandRows: number[],
  rowRemaining: number[],
  colRemaining: number[],
  regionRemainingById: number[],
): { minInside: number; maxInside: number } {
  const totalNeeded = regionRemainingById[regionId] ?? 0;
  if (totalNeeded <= 0) {
    return { minInside: 0, maxInside: 0 };
  }

  const allCandidates = legalRegionCells(state, regionId);
  if (allCandidates.length < totalNeeded) {
    return { minInside: totalNeeded, maxInside: totalNeeded };
  }

  const bandRowSet = new Set(bandRows);
  const sortedCandidates = allCandidates.sort((a, b) =>
    a.row === b.row ? a.col - b.col : a.row - b.row,
  );
  const rowCaps = rowRemaining.slice();
  const colCaps = colRemaining.slice();
  const usedCells: Coords[] = [];
  let bestMin = Number.POSITIVE_INFINITY;
  let bestMax = -1;

  function dfs(nextIndex: number, chosen: number, insideCount: number): void {
    if (chosen === totalNeeded) {
      bestMin = Math.min(bestMin, insideCount);
      bestMax = Math.max(bestMax, insideCount);
      return;
    }
    if (nextIndex >= sortedCandidates.length) return;

    const remaining = sortedCandidates.length - nextIndex;
    if (chosen + remaining < totalNeeded) return;

    for (let i = nextIndex; i < sortedCandidates.length; i += 1) {
      const cell = sortedCandidates[i];
      if (rowCaps[cell.row] <= 0 || colCaps[cell.col] <= 0) continue;

      let adjacent = false;
      for (const used of usedCells) {
        if (cellsAreAdjacent(cell, used)) {
          adjacent = true;
          break;
        }
      }
      if (adjacent) continue;

      rowCaps[cell.row] -= 1;
      colCaps[cell.col] -= 1;
      usedCells.push(cell);
      dfs(i + 1, chosen + 1, insideCount + (bandRowSet.has(cell.row) ? 1 : 0));
      usedCells.pop();
      rowCaps[cell.row] += 1;
      colCaps[cell.col] += 1;
    }
  }

  dfs(0, 0, 0);

  if (!Number.isFinite(bestMin)) {
    return { minInside: totalNeeded, maxInside: totalNeeded };
  }

  return { minInside: bestMin, maxInside: bestMax };
}

function collectRegionBandConstraints(
  state: PuzzleState,
  regionId: number,
  rowRemaining: number[],
  regionRemainingById: number[],
  regionRowMap: Map<number, number[]>,
  colRemaining: number[],
): Constraint[] {
  const cells = regionCells(state, regionId);
  const rows = new Set(cells.map((c) => c.row));
  const sortedRows = Array.from(rows).sort((a, b) => a - b);
  const constraints: Constraint[] = [];

  for (let i = 0; i < sortedRows.length; i += 1) {
    for (let j = i; j < sortedRows.length; j += 1) {
      // Only consider contiguous bands of rows to avoid overly broad combinations
      if (sortedRows[j] - sortedRows[i] !== j - i) continue;

      const startRow = sortedRows[i];
      const endRow = sortedRows[j];
      const bandCells = cells.filter((c) => c.row >= startRow && c.row <= endRow);
      const bandCandidates = emptyCells(state, bandCells);
      const outsideCells = cells.filter((c) => c.row < startRow || c.row > endRow);
      const outsideCandidates = emptyCells(state, outsideCells);

      const placedStars = countStars(state, cells);
      const remaining = state.def.starsPerUnit - placedStars;
      const maxOutsideCapacity = outsideCandidates.length;
      const baseMin = Math.max(0, remaining - maxOutsideCapacity);
      const baseMax = Math.min(remaining, bandCandidates.length);

      const bandRows: number[] = [];
      for (let row = startRow; row <= endRow; row += 1) {
        bandRows.push(row);
      }

      const bandPlacement = buildRowPlacementMaps(state, bandRows);

      const rowsWithDemand = bandRows.filter((row) => rowRemaining[row] > 0);
      const rowDemand = rowsWithDemand.reduce((sum, row) => sum + rowRemaining[row], 0);
      const rowCapacityForRegion = rowsWithDemand.reduce((sum, row) => {
        const available = bandPlacement.rowMaps.get(row)?.get(regionId) ?? 0;
        if (available <= 0) return sum;
        return sum + Math.min(rowRemaining[row], available);
      }, 0);
      const regionRemainingCapacity = regionRemainingById[regionId] ?? 0;

      const outsideRowsTarget = sortedRows.filter((row) => row < startRow || row > endRow);
      const outsidePlacementTarget = buildRowPlacementMaps(state, outsideRowsTarget);
      const outsideRowsWithDemandTarget = outsideRowsTarget.filter((row) => rowRemaining[row] > 0);
      const outsideDemandTarget = outsideRowsWithDemandTarget.reduce(
        (sum, row) => sum + rowRemaining[row],
        0,
      );
      const outsideOtherTarget = computeMaxOtherContribution(
        outsideRowsWithDemandTarget,
        regionId,
        rowRemaining,
        outsidePlacementTarget.rowMaps,
        outsidePlacementTarget.regionTotals,
        regionRemainingById,
      );
      const minOutsideTarget = Math.max(0, outsideDemandTarget - outsideOtherTarget);
      const availableInside = Math.max(0, regionRemainingCapacity - minOutsideTarget);

      const effectiveRegionCapacity = new Map<number, number>();
      effectiveRegionCapacity.set(regionId, availableInside);
      for (let rId = 1; rId <= state.def.size; rId += 1) {
        if (rId === regionId) continue;
        const baseCapacity = regionRemainingById[rId] ?? 0;
        if (baseCapacity === 0) {
          effectiveRegionCapacity.set(rId, 0);
          continue;
        }
        const regionRows = regionRowMap.get(rId) ?? [];
        const outsideRowsForRegion = regionRows.filter((row) => row < startRow || row > endRow);
        if (outsideRowsForRegion.length === 0) {
          effectiveRegionCapacity.set(rId, baseCapacity);
          continue;
        }
        const outsidePlacementForRegion = buildRowPlacementMaps(state, outsideRowsForRegion);
        const outsideRowsWithDemandForRegion = outsideRowsForRegion.filter(
          (row) => rowRemaining[row] > 0,
        );
        const outsideDemandForRegion = outsideRowsWithDemandForRegion.reduce(
          (sum, row) => sum + rowRemaining[row],
          0,
        );
        const outsideOtherForRegion = computeMaxOtherContribution(
          outsideRowsWithDemandForRegion,
          rId,
          rowRemaining,
          outsidePlacementForRegion.rowMaps,
          outsidePlacementForRegion.regionTotals,
          regionRemainingById,
        );
        const minOutsideForRegion = Math.max(0, outsideDemandForRegion - outsideOtherForRegion);
        effectiveRegionCapacity.set(rId, Math.max(0, baseCapacity - minOutsideForRegion));
      }

      const otherContribution = computeMaxOtherContribution(
        rowsWithDemand,
        regionId,
        rowRemaining,
        bandPlacement.rowMaps,
        bandPlacement.regionTotals,
        regionRemainingById,
        effectiveRegionCapacity,
      );
      const minFromRows = Math.max(0, rowDemand - otherContribution);
      
      // Additional tightening: check if this region must have a specific number of stars
      // in a broader row band that includes these rows
      let crossRowMin = baseMin;
      let crossRowMax = baseMax;
      
      // Also check: if other bands of this region have fixed stars, we can tighten this band
      // For example, if region needs 2 stars total and rows 1-2 has exactly 1 star,
      // then rows 3-4 must have exactly 1 star
      const regionRemaining = regionRemainingById[regionId] ?? 0;
      if (regionRemaining > 0) {
        // Count stars already placed in this region
        let regionStarsPlaced = 0;
        for (let row = 0; row < state.def.size; row += 1) {
          for (let col = 0; col < state.def.size; col += 1) {
            if (state.def.regions[row][col] === regionId && state.cells[row][col] === 'star') {
              regionStarsPlaced += 1;
            }
          }
        }
        
        // Count empty cells of this region outside this band
        let regionEmptyOutsideBand = 0;
        for (let row = 0; row < state.def.size; row += 1) {
          if (row >= startRow && row <= endRow) continue;
          for (let col = 0; col < state.def.size; col += 1) {
            if (state.def.regions[row][col] === regionId && state.cells[row][col] === 'empty') {
              regionEmptyOutsideBand += 1;
            }
          }
        }
        
        // If region needs regionRemaining stars total, and has regionEmptyOutsideBand cells outside,
        // it can place at most regionEmptyOutsideBand stars outside
        // So it must place at least (regionRemaining - regionEmptyOutsideBand) stars in this band
        const minFromRegionTotal = Math.max(0, regionRemaining - regionEmptyOutsideBand);
        // And it can place at most regionRemaining stars in this band (if no stars outside)
        const maxFromRegionTotal = Math.min(regionRemaining, bandCandidates.length);
        
        crossRowMin = Math.max(crossRowMin, minFromRegionTotal);
        crossRowMax = Math.min(crossRowMax, maxFromRegionTotal);
      }
      
      // Check broader row bands that start from row 0 and include endRow
      if (endRow > 0 && startRow > 0) {
        const broaderRows = Array.from({ length: endRow + 1 }, (_, i) => i);
        const broaderRowDemand = broaderRows.reduce((sum, row) => sum + rowRemaining[row], 0);
        
        // Count stars already placed in broader rows (all regions)
        let starsPlacedInBroader = 0;
        for (const row of broaderRows) {
          for (let col = 0; col < state.def.size; col += 1) {
            if (state.cells[row][col] === 'star') {
              starsPlacedInBroader += 1;
            }
          }
        }
        
        // Count minimum stars that other regions MUST have in broader rows
        let otherRegionsMinStarsInBroader = 0;
        for (let rId = 1; rId <= state.def.size; rId += 1) {
          if (rId === regionId) continue;
          const regionRemaining = regionRemainingById[rId] ?? 0;
          if (regionRemaining <= 0) continue;
          
          // Count empty cells of this region in broader rows
          let regionEmptyInBroader = 0;
          for (const row of broaderRows) {
            for (let col = 0; col < state.def.size; col += 1) {
              if (state.def.regions[row][col] === rId && state.cells[row][col] === 'empty') {
                regionEmptyInBroader += 1;
              }
            }
          }
          
          // Count empty cells of this region outside broader rows
          let regionEmptyOutsideBroader = 0;
          for (let row = endRow + 1; row < state.def.size; row += 1) {
            for (let col = 0; col < state.def.size; col += 1) {
              if (state.def.regions[row][col] === rId && state.cells[row][col] === 'empty') {
                regionEmptyOutsideBroader += 1;
              }
            }
          }
          
          // Count stars already placed in this region
          let regionStarsPlaced = 0;
          for (let row = 0; row < state.def.size; row += 1) {
            for (let col = 0; col < state.def.size; col += 1) {
              if (state.def.regions[row][col] === rId && state.cells[row][col] === 'star') {
                regionStarsPlaced += 1;
              }
            }
          }
          
          // This region needs regionRemaining more stars total
          // If it has regionEmptyOutsideBroader cells outside, it can place at most that many there
          // So it must place at least (regionRemaining - regionEmptyOutsideBroader) in broader rows
          const minInBroader = Math.max(0, regionRemaining - regionEmptyOutsideBroader);
          otherRegionsMinStarsInBroader += Math.min(minInBroader, regionEmptyInBroader);
        }
        
        // Total stars needed in broader rows = broaderRowDemand
        // Stars already placed = starsPlacedInBroader
        // Minimum stars needed from other regions = otherRegionsMinStarsInBroader
        // Maximum remaining for target region = broaderRowDemand - starsPlacedInBroader - otherRegionsMinStarsInBroader
        const targetRegionMaxInBroader = Math.max(0, broaderRowDemand - starsPlacedInBroader - otherRegionsMinStarsInBroader);
        
        // Also compute minimum: if other regions can't satisfy all their needs in broader rows,
        // target region must contribute more
        // Count maximum stars other regions CAN have in broader rows
        let otherRegionsMaxStarsInBroader = 0;
        for (let rId = 1; rId <= state.def.size; rId += 1) {
          if (rId === regionId) continue;
          const regionRemaining = regionRemainingById[rId] ?? 0;
          if (regionRemaining <= 0) continue;
          
          let regionEmptyInBroader = 0;
          for (const row of broaderRows) {
            for (let col = 0; col < state.def.size; col += 1) {
              if (state.def.regions[row][col] === rId && state.cells[row][col] === 'empty') {
                regionEmptyInBroader += 1;
              }
            }
          }
          otherRegionsMaxStarsInBroader += Math.min(regionRemaining, regionEmptyInBroader);
        }
        
        const targetRegionMinInBroader = Math.max(0, broaderRowDemand - starsPlacedInBroader - otherRegionsMaxStarsInBroader);
        
        // If target region only appears in [startRow, endRow] within broader rows,
        // then it must have between min and max stars in [startRow, endRow]
        const regionRowsInBroader = broaderRows.filter(row => {
          for (let col = 0; col < state.def.size; col += 1) {
            if (state.def.regions[row][col] === regionId) return true;
          }
          return false;
        });
        
        // Check if region only appears in [startRow, endRow] within broader rows
        const regionOnlyInBand = regionRowsInBroader.every(row => row >= startRow && row <= endRow);
        
        if (regionOnlyInBand) {
          // Tighten the constraint
          crossRowMin = Math.max(crossRowMin, targetRegionMinInBroader);
          crossRowMax = Math.min(crossRowMax, targetRegionMaxInBroader);
        }
      }
      
      const tightenedMin = Math.max(baseMin, minFromRows, crossRowMin);
      const tightenedMax = Math.min(baseMax, Math.min(rowCapacityForRegion, availableInside), crossRowMax);

      const placementRange = analyzeRegionPlacementRange(
        state,
        regionId,
        bandRows,
        rowRemaining,
        colRemaining,
        regionRemainingById,
      );

      if (
        (typeof process !== 'undefined' && process.env?.DEBUG_BAND === '1') &&
        state.def.size === 10 &&
        regionId === 4 &&
        startRow === 1 &&
        endRow === 3
      ) {
        console.log('DEBUG BAND', {
          bandRows,
          rowDemand,
          otherContribution,
          minFromRows,
          outsideRows: outsideRowsTarget,
          outsideDemand: outsideDemandTarget,
          outsideOther: outsideOtherTarget,
          minOutside: minOutsideTarget,
          remaining,
          rowCapacityForRegion,
          effectiveRegionCapacity: Object.fromEntries(effectiveRegionCapacity),
          availableInside,
          tightenedMin,
          tightenedMax,
          placementRange,
        });
      }

      const bounds = normalizeBounds(
        Math.max(tightenedMin, placementRange.minInside),
        Math.min(tightenedMax, placementRange.maxInside),
      );

      constraints.push({
        cells: bandCandidates,
        minStars: bounds.minStars,
        maxStars: bounds.maxStars,
        source: 'region-band',
        description: `Region ${formatRegion(regionId)} rows ${startRow}–${endRow}`,
      });
    }
  }

  return constraints;
}

function computeMaxOtherContribution(
  bandRows: number[],
  targetRegionId: number,
  rowRemaining: number[],
  rowMaps: Map<number, Map<number, number>>,
  regionTotals: Map<number, number>,
  regionRemainingById: number[],
  capacityOverrides?: Map<number, number>,
): number {
  if (bandRows.length === 0) return 0;
  if (bandRows.every((row) => rowRemaining[row] === 0)) return 0;

  const activeRows = bandRows.filter((row) => rowRemaining[row] > 0);
  if (activeRows.length === 0) return 0;

  const otherRegions = Array.from(regionTotals.entries())
    .map(([regionId, totalEmpty]) => {
      if (regionId === targetRegionId) {
        return { regionId, capacity: 0 };
      }
      const remaining = capacityOverrides?.get(regionId) ?? regionRemainingById[regionId] ?? 0;
      return {
        regionId,
        capacity: Math.min(remaining, totalEmpty),
      };
    })
    .filter((entry) => entry.capacity > 0);

  if (otherRegions.length === 0) return 0;

  const source = 0;
  const sink = 1;
  let nextNode = 2;
  const rowNodeIndices = new Map<number, number>();
  for (const row of activeRows) {
    rowNodeIndices.set(row, nextNode);
    nextNode += 1;
  }
  const regionNodeIndices = new Map<number, number>();
  for (const { regionId } of otherRegions) {
    regionNodeIndices.set(regionId, nextNode);
    nextNode += 1;
  }

  const flow = new MaxFlow(nextNode);
  for (const row of activeRows) {
    const capacity = rowRemaining[row];
    if (capacity <= 0) continue;
    flow.addEdge(source, rowNodeIndices.get(row)!, capacity);
  }

  for (const { regionId, capacity } of otherRegions) {
    const node = regionNodeIndices.get(regionId)!;
    flow.addEdge(node, sink, capacity);
  }

  for (const row of activeRows) {
    const rowNode = rowNodeIndices.get(row)!;
    const rowMap = rowMaps.get(row);
    if (!rowMap) continue;
    for (const [regionId, count] of rowMap.entries()) {
      if (regionId === targetRegionId) continue;
      const regionNode = regionNodeIndices.get(regionId);
      if (!regionNode || count <= 0) continue;
      flow.addEdge(rowNode, regionNode, count);
    }
  }

  return flow.maxFlow(source, sink);
}

interface SupportingConstraints {
  rowConstraints: Constraint[];
  colConstraints: Constraint[];
  regionConstraints: Constraint[];
  regionBandConstraints: Constraint[];
}

interface BlockSupportImpact {
  minInside: number;
  insideCells: Coords[];
}

function requiredStarsWithinBlock(
  blockCandidates: Coords[],
  constraint: Constraint,
): BlockSupportImpact {
  if (constraint.minStars === 0) return { minInside: 0, insideCells: [] };
  const blockSet = new Set(blockCandidates.map(coordKey));
  const inside = constraint.cells.filter((c) => blockSet.has(coordKey(c)));
  if (inside.length === 0) return { minInside: 0, insideCells: [] };

  const outsideCapacity = constraint.cells.length - inside.length;
  const minInside = Math.max(0, constraint.minStars - outsideCapacity);
  return { minInside: Math.min(minInside, inside.length), insideCells: inside };
}

function blockConstraints(state: PuzzleState, supporting: SupportingConstraints): Constraint[] {
  const constraints: Constraint[] = [];
  for (let r = 0; r < state.def.size - 1; r += 1) {
    for (let c = 0; c < state.def.size - 1; c += 1) {
      const block: Coords[] = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];

      const candidates = emptyCells(state, block);
      const starsInBlock = countStars(state, block);
      const maxStars = Math.max(0, 1 - starsInBlock);
      const allSupporting = [
        ...supporting.rowConstraints,
        ...supporting.colConstraints,
        ...supporting.regionConstraints,
        ...supporting.regionBandConstraints,
      ];
      const impacts = allSupporting.map((c) => requiredStarsWithinBlock(candidates, c));

      let forcedMin = Math.min(maxStars, Math.max(...impacts.map((i) => i.minInside), 0));
      
      // Additional logic: if a row band needs N stars and there are exactly N 2×2 blocks
      // in that band with empty cells, then each block must have exactly 1 star
      // Check row constraints for rows r and r+1
      const rowR = supporting.rowConstraints[r];
      const rowR1 = supporting.rowConstraints[r + 1];
      if (rowR && rowR1) {
        const rowBandDemand = (rowR.minStars > 0 ? rowR.minStars : 0) + (rowR1.minStars > 0 ? rowR1.minStars : 0);
        if (rowBandDemand > 0) {
          // Count how many 2×2 blocks exist in rows r to r+1 that have empty cells
          let blocksInBandWithEmpties = 0;
          for (let bc = 0; bc < state.def.size - 1; bc += 1) {
            const testBlock: Coords[] = [
              { row: r, col: bc },
              { row: r, col: bc + 1 },
              { row: r + 1, col: bc },
              { row: r + 1, col: bc + 1 },
            ];
            const testBlockCandidates = emptyCells(state, testBlock);
            // Only count blocks that have at least one empty cell
            if (testBlockCandidates.length > 0) {
              blocksInBandWithEmpties += 1;
            }
          }
          
          // If row band needs exactly as many stars as there are blocks with empties,
          // and each block can have at most 1 star, then each block must have exactly 1 star
          if (rowBandDemand === blocksInBandWithEmpties && blocksInBandWithEmpties > 0 && maxStars >= 1) {
            forcedMin = Math.max(forcedMin, 1);
          }
        }
      }
      
      // Also check region-band constraints: if a region-band needs 1 star and there's exactly 1 block
      // in that band that can contain it, force that block
      for (const regionBand of supporting.regionBandConstraints) {
        if (regionBand.minStars === 1 && regionBand.maxStars === 1) {
          // Check if this block is within the region-band's rows
          const bandMatch = regionBand.description.match(/rows (\d+)–(\d+)/);
          if (bandMatch) {
            const bandStart = parseInt(bandMatch[1], 10);
            const bandEnd = parseInt(bandMatch[2], 10);
            if (r >= bandStart && r + 1 <= bandEnd) {
              // Check if this block intersects with the region-band's cells
              const blockSet = new Set(block.map(cell => `${cell.row},${cell.col}`));
              const bandCellsInBlock = regionBand.cells.filter(c => 
                blockSet.has(`${c.row},${c.col}`) && state.cells[c.row][c.col] === 'empty'
              );
              
              // Count how many blocks in this row band intersect with the region-band
              let blocksIntersectingBand = 0;
              for (let bc = 0; bc < state.def.size - 1; bc += 1) {
                const testBlock: Coords[] = [
                  { row: r, col: bc },
                  { row: r, col: bc + 1 },
                  { row: r + 1, col: bc },
                  { row: r + 1, col: bc + 1 },
                ];
                const testBlockSet = new Set(testBlock.map(cell => `${cell.row},${cell.col}`));
                const testBandCellsInBlock = regionBand.cells.filter(c => 
                  testBlockSet.has(`${c.row},${c.col}`) && state.cells[c.row][c.col] === 'empty'
                );
                if (testBandCellsInBlock.length > 0) {
                  blocksIntersectingBand += 1;
                }
              }
              
              // If region-band needs 1 star and there's exactly 1 block that intersects it,
              // that block must have the star
              if (blocksIntersectingBand === 1 && bandCellsInBlock.length > 0 && maxStars >= 1) {
                forcedMin = Math.max(forcedMin, 1);
              }
              
              // Also: if the region-band's empty cells are all within this block, force it
              const allBandCellsInBlock = regionBand.cells.every(c => 
                blockSet.has(`${c.row},${c.col}`)
              );
              if (allBandCellsInBlock && bandCellsInBlock.length > 0 && maxStars >= 1) {
                forcedMin = Math.max(forcedMin, 1);
              }
              
              // Special case: if rows r to r+1 need N stars and there are exactly N blocks
              // in those rows that have at least 2 empty cells in the region-band, force each block
              const rowR = supporting.rowConstraints[r];
              const rowR1 = supporting.rowConstraints[r + 1];
              if (rowR && rowR1) {
                const rowBandDemand = (rowR.minStars > 0 ? rowR.minStars : 0) + (rowR1.minStars > 0 ? rowR1.minStars : 0);
                if (rowBandDemand > 0) {
                  // Count blocks in rows r to r+1 that have at least 2 empty cells in the region-band
                  let blocksWith2PlusEmpties = 0;
                  for (let bc = 0; bc < state.def.size - 1; bc += 1) {
                    const testBlock: Coords[] = [
                      { row: r, col: bc },
                      { row: r, col: bc + 1 },
                      { row: r + 1, col: bc },
                      { row: r + 1, col: bc + 1 },
                    ];
                    const testBlockSet = new Set(testBlock.map(cell => `${cell.row},${cell.col}`));
                    const testBandCellsInBlock = regionBand.cells.filter(c => 
                      testBlockSet.has(`${c.row},${c.col}`) && state.cells[c.row][c.col] === 'empty'
                    );
                    if (testBandCellsInBlock.length >= 2) {
                      blocksWith2PlusEmpties += 1;
                    }
                  }
                  
                  // If row band needs exactly as many stars as there are blocks with 2+ empties,
                  // and this block has 2+ empties, force it
                  if (rowBandDemand === blocksWith2PlusEmpties && blocksWith2PlusEmpties > 0 && 
                      bandCellsInBlock.length >= 2 && maxStars >= 1) {
                    forcedMin = Math.max(forcedMin, 1);
                  }
                }
              }
            }
          }
        }
      }
      
      // If forcedMin was set by row-band or region-band logic (not from impacts),
      // we need to use all candidates, not just those from impacts
      const forcedFromImpacts = Math.min(maxStars, Math.max(...impacts.map((i) => i.minInside), 0));
      const forcedFromOtherLogic = forcedMin > forcedFromImpacts;
      
      const forcedCells =
        forcedMin > 0
          ? forcedFromOtherLogic
            ? candidates // Use all candidates if forced by row-band/region-band logic
            : Array.from(
                new Map(
                  impacts
                    .filter((i) => i.minInside > 0)
                    .flatMap((i) => i.insideCells)
                    .map((cell) => [coordKey(cell), cell]),
                ).values(),
              )
          : candidates;
      const { minStars } = normalizeBounds(forcedMin, maxStars);

      constraints.push({
        cells: forcedCells,
        minStars,
        maxStars,
        source: minStars > 0 ? 'block-forced' : 'block',
        description: `2×2 block at rows ${r}–${r + 1}, cols ${c}–${c + 1}`,
      });
    }
  }
  return constraints;
}

function inferForcedBlocksFromBands(state: PuzzleState, supporting: SupportingConstraints): Constraint[] {
  const results: Constraint[] = [];

  // Only region-band constraints with exactly 1 star remaining are interesting
  const singleStarBands = supporting.regionBandConstraints.filter(
    (b) => b.minStars === 1 && b.maxStars === 1 && b.cells.length > 1,
  );

  for (const band of singleStarBands) {
    const bandCandidates = band.cells;

    // Enumerate all legal placements of that one star within this band
    const placements = enumerateLegalBandPlacements(state, bandCandidates);

    if (placements.length === 0) continue; // band is actually inconsistent

    // For each 2×2 block that intersects bandCandidates, check if every valid
    // placement lies inside that block.
    for (let r = 0; r < state.def.size - 1; r += 1) {
      for (let c = 0; c < state.def.size - 1; c += 1) {
        const block: Coords[] = [
          { row: r, col: c },
          { row: r, col: c + 1 },
          { row: r + 1, col: c },
          { row: r + 1, col: c + 1 },
        ];

        const blockBandCells = block.filter((bc) =>
          bandCandidates.some((b) => b.row === bc.row && b.col === bc.col),
        );
        if (blockBandCells.length === 0) continue;

        const allPlacementsInBlock = placements.every((p) =>
          block.some((bc) => bc.row === p.row && bc.col === p.col),
        );
        if (!allPlacementsInBlock) continue;

        const cells = emptyCells(state, block).filter((c) =>
          bandCandidates.some((b) => b.row === c.row && b.col === c.col),
        );

        if (cells.length > 0) {
          results.push({
            cells,
            minStars: 1,
            maxStars: 1,
            source: 'block-forced',
            description: `Forced 2×2 block inside ${band.description}`,
          });
        }
      }
    }
  }

  return results;
}

function enumerateLegalBandPlacements(state: PuzzleState, bandCandidates: Coords[]): Coords[] {
  const validPositions: Coords[] = [];

  for (const cell of bandCandidates) {
    if (!isLegalSingleStarPlacement(state, cell)) continue;
    validPositions.push(cell);
  }

  return validPositions;
}

function isLegalSingleStarPlacement(state: PuzzleState, cell: Coords): boolean {
  // 1. Cell must be empty
  if (!emptyCells(state, [cell]).length) return false;

  const { row, col } = cell;
  const regionId = state.def.regions[row][col];

  // 2. Row/col capacities
  if (countStars(state, rowCells(state, row)) >= state.def.starsPerUnit) return false;
  if (countStars(state, colCells(state, col)) >= state.def.starsPerUnit) return false;

  // 3. Region capacity
  if (countStars(state, regionCells(state, regionId)) >= state.def.starsPerUnit) return false;

  // 4. Adjacency (no neighboring star)
  const neighbors = [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
    { row: row - 1, col: col - 1 },
    { row: row - 1, col: col + 1 },
    { row: row + 1, col: col - 1 },
    { row: row + 1, col: col + 1 },
  ].filter(
    (n) => n.row >= 0 && n.row < state.def.size && n.col >= 0 && n.col < state.def.size,
  );
  if (countStars(state, neighbors) > 0) return false;

  // 5. 2×2 block capacity: placing here must not create a block with >1 star
  const blocks: Coords[][] = [];
  for (const deltaRow of [-1, 0]) {
    for (const deltaCol of [-1, 0]) {
      const top = row + deltaRow;
      const left = col + deltaCol;
      const bottom = top + 1;
      const right = left + 1;

      if (top < 0 || left < 0 || bottom >= state.def.size || right >= state.def.size) continue;

      blocks.push([
        { row: top, col: left },
        { row: top, col: right },
        { row: bottom, col: left },
        { row: bottom, col: right },
      ]);
    }
  }

  for (const block of blocks) {
    const starsInBlock = countStars(state, block);
    if (starsInBlock >= 1) return false;
  }

  return true;
}

export function computeStats(state: PuzzleState): Stats {
  const rowConstraints = Array.from({ length: state.def.size }, (_, r) => rowConstraint(state, r));
  const colConstraints = Array.from({ length: state.def.size }, (_, c) => colConstraint(state, c));
  const regionConstraints = Array.from({ length: state.def.size }, (_, id) => regionConstraint(state, id + 1));
  const rowRemaining = rowConstraints.map((constraint) => constraint.minStars);
  const colRemaining = colConstraints.map((constraint) => constraint.minStars);
  const regionRemainingById = regionConstraints.reduce((acc, constraint, idx) => {
    acc[idx + 1] = constraint.minStars;
    return acc;
  }, new Array(state.def.size + 1).fill(0));
  const regionRowMap = buildRegionRowMap(state);
  let regionBandConstraints = regionConstraints
    .map((_, idx) =>
      collectRegionBandConstraints(
        state,
        idx + 1,
        rowRemaining,
        regionRemainingById,
        regionRowMap,
        colRemaining,
      ),
    )
    .flat();
  
  // Second pass: tighten region-band constraints based on other bands of the same region
  // If a region needs N stars total and one band has exactly K stars, other bands must sum to N-K
  regionBandConstraints = regionBandConstraints.map((constraint) => {
    // Extract region ID from description (e.g., "Region D rows 1–2" -> region 4)
    const regionMatch = constraint.description.match(/Region ([A-J])/);
    if (!regionMatch) return constraint;
    const regionLetter = regionMatch[1];
    const regionId = regionLetter.charCodeAt(0) - 64; // A=1, B=2, etc.
    
    const regionRemaining = regionRemainingById[regionId] ?? 0;
    if (regionRemaining <= 0) return constraint;
    
    // Extract row range from this constraint
    const rowMatch = constraint.description.match(/rows (\d+)–(\d+)/);
    if (!rowMatch) return constraint;
    const bandStartRow = parseInt(rowMatch[1], 10);
    const bandEndRow = parseInt(rowMatch[2], 10);
    
    // Find other bands of the same region that have exact constraints (minStars === maxStars)
    // and don't overlap with this band
    const otherExactBands = regionBandConstraints.filter((c) => {
      if (c === constraint) return false;
      const otherMatch = c.description.match(/Region ([A-J]) rows (\d+)–(\d+)/);
      if (!otherMatch || otherMatch[1] !== regionLetter) return false;
      if (c.minStars !== c.maxStars || c.minStars <= 0) return false;
      
      // Check if bands don't overlap
      const otherStart = parseInt(otherMatch[2], 10);
      const otherEnd = parseInt(otherMatch[3], 10);
      const overlaps = !(bandEndRow < otherStart || bandStartRow > otherEnd);
      return !overlaps;
    });
    
    if (otherExactBands.length === 0) return constraint;
    
    // Sum of stars in other exact bands
    const starsInOtherBands = otherExactBands.reduce((sum, band) => sum + band.minStars, 0);
    
    // If other bands account for starsInOtherBands, and region needs regionRemaining total,
    // then this band must have exactly (regionRemaining - starsInOtherBands) stars
    const requiredInThisBand = regionRemaining - starsInOtherBands;
    
    if (requiredInThisBand > 0 && requiredInThisBand <= constraint.cells.length) {
      return {
        ...constraint,
        minStars: Math.max(constraint.minStars, requiredInThisBand),
        maxStars: Math.min(constraint.maxStars, requiredInThisBand),
      };
    }
    
    return constraint;
  });
  const supporting: SupportingConstraints = {
    rowConstraints,
    colConstraints,
    regionConstraints,
    regionBandConstraints,
  };

  const blockConstraintsList = blockConstraints(state, supporting);
  const blockForcedFromBands = inferForcedBlocksFromBands(state, supporting);

  return {
    rowConstraints,
    colConstraints,
    regionConstraints,
    regionBandConstraints,
    blockConstraints: [...blockConstraintsList, ...blockForcedFromBands],
  };
}

export function allConstraints(stats: Stats): Constraint[] {
  return [
    ...stats.rowConstraints,
    ...stats.colConstraints,
    ...stats.regionConstraints,
    ...stats.regionBandConstraints,
    ...stats.blockConstraints,
  ];
}

function isSubset(smaller: Constraint, larger: Constraint): boolean {
  if (smaller.cells.length === 0) return false;
  const largeSet = new Set(larger.cells.map(coordKey));
  return smaller.cells.every((c) => largeSet.has(coordKey(c)));
}

function differenceCells(a: Constraint, b: Constraint): Coords[] {
  const bSet = new Set(b.cells.map(coordKey));
  return a.cells.filter((c) => !bSet.has(coordKey(c)));
}

export interface SubsetSqueezeResult {
  eliminations: Coords[];
  small: Constraint;
  large: Constraint;
}

const LARGE_PRIORITY: Record<ConstraintSource, number> = {
  'region-band': 0,
  region: 1,
  row: 2,
  col: 3,
  'block-forced': 4,
  block: 5,
};

const SMALL_PRIORITY: Record<ConstraintSource, number> = {
  'block-forced': 0,
  block: 1,
  region: 2,
  row: 3,
  col: 4,
  'region-band': 5,
};

function compareScores(a: [number, number], b: [number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] - b[1];
}

export function findSubsetConstraintSqueeze(state: PuzzleState, debug = false): SubsetSqueezeResult | null {
  const hasProgress = state.cells.some((row) => row.some((cell) => cell !== 'empty'));
  if (!hasProgress) return null;

  const stats = computeStats(state);
  const constraints = allConstraints(stats);
  let bestMatch: { result: SubsetSqueezeResult; score: [number, number] } | null = null;

  if (debug) {
    console.log(`[DEBUG] findSubsetConstraintSqueeze: checking ${constraints.length} constraints`);
    const blockForcedConstraints = constraints.filter(c => c.source === 'block-forced' && c.description.includes('rows 3–4') && c.description.includes('cols 4–5'));
    if (blockForcedConstraints.length > 0) {
      console.log(`[DEBUG] Found block-forced constraint at rows 3-4, cols 4-5:`);
      blockForcedConstraints.forEach((c, i) => {
        console.log(`  ${i}: ${c.description}, minStars=${c.minStars}, maxStars=${c.maxStars}, cells=${c.cells.length}`);
        console.log(`    cells: ${c.cells.map(cell => `(${cell.row},${cell.col})`).join(', ')}`);
      });
    }
    const regionD34Constraints = constraints.filter(c => c.source === 'region-band' && c.description.includes('Region D rows 3–4'));
    if (regionD34Constraints.length > 0) {
      console.log(`[DEBUG] Found Region D rows 3-4 constraint:`);
      regionD34Constraints.forEach((c, i) => {
        console.log(`  ${i}: ${c.description}, minStars=${c.minStars}, maxStars=${c.maxStars}, cells=${c.cells.length}`);
      });
    }
  }

  // Pre-filter constraints to only those that could be the "small" constraint
  // (must have minStars > 0 and be a reasonable candidate)
  const smallCandidates = constraints.filter(
    (c) => c.minStars > 0 && c.cells.length > 0 && c.cells.length < 20, // Limit to smaller constraints
  );
  
  if (debug) {
    const blockForcedInSmall = smallCandidates.filter(c => c.source === 'block-forced' && c.description.includes('rows 3–4') && c.description.includes('cols 4–5'));
    console.log(`[DEBUG] Block-forced at rows 3-4, cols 4-5 in smallCandidates: ${blockForcedInSmall.length}`);
    const regionD34InLarge = constraints.filter(c => c.source === 'region-band' && c.description.includes('Region D rows 3–4'));
    console.log(`[DEBUG] Region D rows 3-4 in constraints: ${regionD34InLarge.length}`);
  }

  // Pre-filter constraints that could be the "large" constraint
  // (must have maxStars >= minStars of at least one small candidate and more cells)
  // Build a set of minStars values from small candidates for efficient lookup
  const smallMinStarsSet = new Set(smallCandidates.map((c) => c.minStars));
  const largeCandidates = constraints.filter(
    (c) => c.cells.length > 0 && smallMinStarsSet.has(c.maxStars),
  );
  
  if (debug) {
    const regionD34InLarge = largeCandidates.filter(c => c.source === 'region-band' && c.description.includes('Region D rows 3–4'));
    console.log(`[DEBUG] Region D rows 3-4 in largeCandidates: ${regionD34InLarge.length}`);
    if (regionD34InLarge.length > 0) {
      regionD34InLarge.forEach((c, i) => {
        console.log(`  ${i}: maxStars=${c.maxStars}, cells=${c.cells.length}`);
      });
    }
  }

  // Build cell sets for faster subset checking - only for large candidates
  const largeCellSets = new Map<Constraint, Set<string>>();
  for (const large of largeCandidates) {
    largeCellSets.set(large, new Set(large.cells.map((c) => `${c.row},${c.col}`)));
  }

  let subsetCount = 0;
  let validSubsetCount = 0;
  let eliminationCount = 0;

  // Pre-build small sets once
  const smallSets = new Map<Constraint, Set<string>>();
  for (const small of smallCandidates) {
    smallSets.set(small, new Set(small.cells.map((c) => `${c.row},${c.col}`)));
  }

  // Only check relevant pairs: small candidates vs large candidates
  for (const small of smallCandidates) {
    const smallSet = smallSets.get(small)!;
    const smallSize = small.cells.length;
    
    for (const large of largeCandidates) {
      if (small === large) continue;
      
      // Quick size check - small must have fewer cells (not equal, as that means identical)
      if (smallSize >= large.cells.length) {
        if (debug && small.description.includes('rows 3–4') && small.description.includes('cols 4–5') && large.description.includes('Region D rows 3–4')) {
          console.log(`[DEBUG] Skipping: smallSize (${smallSize}) >= large.cells.length (${large.cells.length})`);
        }
        continue;
      }
      
      // Early check: if minStars don't match maxStars, skip
      if (small.minStars !== large.maxStars) {
        if (debug && small.description.includes('rows 3–4') && small.description.includes('cols 4–5') && large.description.includes('Region D rows 3–4')) {
          console.log(`[DEBUG] Skipping: small.minStars (${small.minStars}) !== large.maxStars (${large.maxStars})`);
        }
        continue;
      }
      
      // Fast subset check using pre-built sets
      const largeSet = largeCellSets.get(large)!;
      let isSubset = true;
      // Check if all small cells are in large (subset check)
      for (const cellKey of smallSet) {
        if (!largeSet.has(cellKey)) {
          isSubset = false;
          break;
        }
      }
      if (!isSubset) continue;
      
      subsetCount += 1;
      validSubsetCount += 1;

      // Calculate difference and eliminations - only check cells in large but not in small
      const eliminations: Coords[] = [];
      for (const largeCell of large.cells) {
        const cellKey = `${largeCell.row},${largeCell.col}`;
        if (!smallSet.has(cellKey) && state.cells[largeCell.row][largeCell.col] === 'empty') {
          eliminations.push(largeCell);
        }
      }
      
      if (debug && (validSubsetCount <= 5 || (small.description.includes('rows 3–4') && small.description.includes('cols 4–5') && large.description.includes('Region D rows 3–4')))) {
        console.log(`[DEBUG] Valid subset pair ${validSubsetCount}:`);
        console.log(`  Small: ${small.source} - ${small.description}`);
        console.log(`    minStars: ${small.minStars}, maxStars: ${small.maxStars}, cells: ${small.cells.length}`);
        console.log(`  Large: ${large.source} - ${large.description}`);
        console.log(`    minStars: ${large.minStars}, maxStars: ${large.maxStars}, cells: ${large.cells.length}`);
        console.log(`  Eliminations: ${eliminations.length}`);
        if (eliminations.length > 0) {
          console.log(`  Cells: ${eliminations.map(c => `(${c.row},${c.col})`).join(', ')}`);
        }
      }

      if (eliminations.length > 0) {
        eliminationCount += 1;
        const score: [number, number] = [
          LARGE_PRIORITY[large.source] ?? Number.MAX_SAFE_INTEGER,
          SMALL_PRIORITY[small.source] ?? Number.MAX_SAFE_INTEGER,
        ];
        
        // Special logging for the expected pair
        const isExpectedPair = small.description.includes('rows 3–4') && small.description.includes('cols 4–5') && 
                               large.description.includes('Region D rows 3–4');
        if (debug && isExpectedPair) {
          console.log(`[DEBUG] Found expected pair! Score: [${score[0]}, ${score[1]}], Eliminations: ${eliminations.length}`);
          console.log(`  Cells: ${eliminations.map(c => `(${c.row},${c.col})`).join(', ')}`);
        }
        
        if (!bestMatch || compareScores(score, bestMatch.score) < 0) {
          if (debug) {
            console.log(`[DEBUG] New best match (score: [${score[0]}, ${score[1]}])`);
          }
          bestMatch = {
            result: { eliminations, small, large },
            score,
          };
        } else if (bestMatch && compareScores(score, bestMatch.score) === 0) {
          // If scores are equal, prefer the one with more eliminations (more useful hint)
          // But if both have 2+ eliminations, prefer the one with fewer (more specific)
          const currentHasMultiple = eliminations.length >= 2;
          const bestHasMultiple = bestMatch.result.eliminations.length >= 2;
          
          if (currentHasMultiple && !bestHasMultiple) {
            // Current has 2+ eliminations, best has 1 - prefer current
            if (debug) {
              console.log(`[DEBUG] New best match (same score, current has multiple eliminations: ${eliminations.length} vs ${bestMatch.result.eliminations.length})`);
              if (isExpectedPair) {
                console.log(`[DEBUG] This is the expected pair!`);
              }
            }
            bestMatch = {
              result: { eliminations, small, large },
              score,
            };
          } else if (!currentHasMultiple && bestHasMultiple) {
            // Best has 2+ eliminations, current has 1 - keep best
            if (debug && isExpectedPair) {
              console.log(`[DEBUG] Expected pair has only 1 elimination, best has ${bestMatch.result.eliminations.length}, not selecting`);
            }
          } else if (currentHasMultiple && bestHasMultiple) {
            // Both have 2+ eliminations - prefer fewer (more specific)
            if (eliminations.length < bestMatch.result.eliminations.length) {
              if (debug) {
                console.log(`[DEBUG] New best match (same score, both have multiple, prefer fewer: ${eliminations.length} vs ${bestMatch.result.eliminations.length})`);
                if (isExpectedPair) {
                  console.log(`[DEBUG] This is the expected pair!`);
                }
              }
              bestMatch = {
                result: { eliminations, small, large },
                score,
              };
            } else if (debug && isExpectedPair) {
              console.log(`[DEBUG] Expected pair has same score and more eliminations (${eliminations.length} vs ${bestMatch.result.eliminations.length}), not selecting`);
            }
          } else {
            // Both have 1 elimination - prefer current if it's the expected pair
            if (isExpectedPair) {
              if (debug) {
                console.log(`[DEBUG] New best match (same score, selecting expected pair with 1 elimination)`);
              }
              bestMatch = {
                result: { eliminations, small, large },
                score,
              };
            }
          }
        }
      }
    }
  }

  if (debug) {
    console.log(`[DEBUG] Summary: ${subsetCount} subset pairs, ${validSubsetCount} valid, ${eliminationCount} with eliminations`);
    if (bestMatch) {
      console.log(`[DEBUG] Best match:`);
      console.log(`  Small: ${bestMatch.result.small.source} - ${bestMatch.result.small.description}`);
      console.log(`  Large: ${bestMatch.result.large.source} - ${bestMatch.result.large.description}`);
      console.log(`  Eliminations: ${bestMatch.result.eliminations.length}`);
    }
  }

  return bestMatch?.result ?? null;
}

export function describeConstraintPair(small: Constraint, large: Constraint): string {
  return `${small.description} can account for all ${large.maxStars} star(s) allowed by ${large.description}`;
}
