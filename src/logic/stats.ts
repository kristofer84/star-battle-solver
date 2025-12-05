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

export function computeStats(state: PuzzleState): Stats {
  const rowConstraints = Array.from({ length: state.def.size }, (_, r) => rowConstraint(state, r));
  const colConstraints = Array.from({ length: state.def.size }, (_, c) => colConstraint(state, c));
  const regionConstraints = Array.from({ length: state.def.size }, (_, id) => regionConstraint(state, id + 1));
  const regionBandConstraints = regionConstraints
    .map((_, idx) => collectRegionBandConstraints(state, idx + 1))
    .flat();
  const blockConstraintsList = blockConstraints(state, {
    rowConstraints,
    colConstraints,
    regionConstraints,
    regionBandConstraints,
  });

  return {
    rowConstraints,
    colConstraints,
    regionConstraints,
    regionBandConstraints,
    blockConstraints: blockConstraintsList,
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
