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

function collectRegionBandConstraints(state: PuzzleState, regionId: number): Constraint[] {
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
      const minStars = Math.max(0, remaining - maxOutsideCapacity);
      const maxStars = Math.min(remaining, bandCandidates.length);
      const bounds = normalizeBounds(minStars, maxStars);

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

    // For each 2×2 block that intersects bandCandidates, check if
    // every valid placement uses at least one cell inside that block.
    const forcedBlocks = collectForcedBlocks(state, bandCandidates, placements);

    for (const blockCells of forcedBlocks) {
      const blockBandCells = emptyCells(state, blockCells).filter((c) =>
        bandCandidates.some((b) => b.row === c.row && b.col === c.col),
      );
      if (blockBandCells.length === 0) continue;

      results.push({
        cells: blockBandCells,
        minStars: 1,
        maxStars: 1,
        source: 'block-forced',
        description: `Forced 2×2 block inside ${band.description}`,
      });
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
  const blocks: Coords[][] = [
    // block with cell at top-left
    [
      { row, col },
      { row, col: col + 1 },
      { row: row + 1, col },
      { row: row + 1, col: col + 1 },
    ],
    // block with cell at top-right
    [
      { row, col: col - 1 },
      { row, col },
      { row: row + 1, col: col - 1 },
      { row: row + 1, col },
    ],
    // block with cell at bottom-left
    [
      { row: row - 1, col },
      { row: row - 1, col: col + 1 },
      { row, col },
      { row, col: col + 1 },
    ],
    // block with cell at bottom-right
    [
      { row: row - 1, col: col - 1 },
      { row: row - 1, col },
      { row, col: col - 1 },
      { row, col },
    ],
  ].map((block) =>
    block.filter(
      (b) => b.row >= 0 && b.row < state.def.size && b.col >= 0 && b.col < state.def.size,
    ),
  );

  for (const block of blocks) {
    const starsInBlock = countStars(state, block);
    if (starsInBlock >= 1) return false;
  }

  return true;
}

function collectForcedBlocks(
  state: PuzzleState,
  bandCandidates: Coords[],
  placements: Coords[],
): Coords[][] {
  const forcedBlocks: Coords[][] = [];

  for (let r = 0; r < state.def.size - 1; r += 1) {
    for (let c = 0; c < state.def.size - 1; c += 1) {
      const block: Coords[] = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];

      // Only care about blocks that touch the band
      const blockBandCells = block.filter((bc) =>
        bandCandidates.some((b) => b.row === bc.row && b.col === bc.col),
      );
      if (blockBandCells.length === 0) continue;

      // Check if *every* valid placement lies inside this block
      const allPlacementsInBlock = placements.every((p) =>
        block.some((bc) => bc.row === p.row && bc.col === p.col),
      );
      if (!allPlacementsInBlock) continue;

      forcedBlocks.push(block);
    }
  }

  return forcedBlocks;
}

export function computeStats(state: PuzzleState): Stats {
  const rowConstraints = Array.from({ length: state.def.size }, (_, r) => rowConstraint(state, r));
  const colConstraints = Array.from({ length: state.def.size }, (_, c) => colConstraint(state, c));
  const regionConstraints = Array.from({ length: state.def.size }, (_, id) => regionConstraint(state, id + 1));
  const regionBandConstraints = regionConstraints
    .map((_, idx) => collectRegionBandConstraints(state, idx + 1))
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

export function findSubsetConstraintSqueeze(state: PuzzleState): SubsetSqueezeResult | null {
  const stats = computeStats(state);
  const constraints = allConstraints(stats);

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
        return { eliminations, small, large };
      }
    }
  }

  return null;
}

export function describeConstraintPair(small: Constraint, large: Constraint): string {
  return `${small.description} can account for all ${large.maxStars} star(s) allowed by ${large.description}`;
}
