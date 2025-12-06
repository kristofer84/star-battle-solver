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

function collectRegionBandConstraints(
  state: PuzzleState,
  regionId: number,
  rowRemaining: number[],
  regionRemainingById: number[],
  regionRowMap: Map<number, number[]>,
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
      const tightenedMin = Math.max(baseMin, minFromRows);
      const tightenedMax = Math.min(baseMax, Math.min(rowCapacityForRegion, availableInside));

      if (
        process.env.DEBUG_BAND === '1' &&
        state.def.size === 10 &&
        regionId === 4 &&
        startRow === 2 &&
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
        });
      }

      const bounds = normalizeBounds(tightenedMin, tightenedMax);

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

      const forcedMin = Math.min(maxStars, Math.max(...impacts.map((i) => i.minInside), 0));
      const forcedCells =
        forcedMin > 0
          ? Array.from(
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
  const regionRemainingById = regionConstraints.reduce((acc, constraint, idx) => {
    acc[idx + 1] = constraint.minStars;
    return acc;
  }, new Array(state.def.size + 1).fill(0));
  const regionRowMap = buildRegionRowMap(state);
  const regionBandConstraints = regionConstraints
    .map((_, idx) =>
      collectRegionBandConstraints(state, idx + 1, rowRemaining, regionRemainingById, regionRowMap),
    )
    .flat();
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

export function findSubsetConstraintSqueeze(state: PuzzleState): SubsetSqueezeResult | null {
  const hasProgress = state.cells.some((row) => row.some((cell) => cell !== 'empty'));
  if (!hasProgress) return null;

  const stats = computeStats(state);
  const constraints = allConstraints(stats);
  let bestMatch: { result: SubsetSqueezeResult; score: [number, number] } | null = null;

  for (const small of constraints) {
    for (const large of constraints) {
      if (small === large) continue;
      if (!isSubset(small, large)) continue;
      if (small.minStars === 0) continue;
      if (small.minStars !== large.maxStars) continue;

      const eliminations: Coords[] = [];
      const diff = differenceCells(large, small);
      for (const cell of diff) {
        if (state.cells[cell.row][cell.col] === 'empty') {
          eliminations.push(cell);
        }
      }
      if (eliminations.length > 0) {
        const score: [number, number] = [
          LARGE_PRIORITY[large.source] ?? Number.MAX_SAFE_INTEGER,
          SMALL_PRIORITY[small.source] ?? Number.MAX_SAFE_INTEGER,
        ];
        if (!bestMatch || compareScores(score, bestMatch.score) < 0) {
          bestMatch = {
            result: { eliminations, small, large },
            score,
          };
        }
      }
    }
  }

  return bestMatch?.result ?? null;
}

export function describeConstraintPair(small: Constraint, large: Constraint): string {
  return `${small.description} can account for all ${large.maxStars} star(s) allowed by ${large.description}`;
}
