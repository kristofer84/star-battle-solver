import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import { colCells, rowCells, emptyCells, countStars, neighbors8 } from '../helpers';

let hintCounter = 0;
function nextHintId() {
  hintCounter += 1;
  return `band-deficit-${hintCounter}`;
}

/**
 * Greedily partitions a set of cells into non-overlapping 2×2 blocks plus a
 * leftover set R.  Scans top-to-bottom then left-to-right; whenever the
 * current cell and its right / below / below-right neighbours are all present
 * (and unused), they form a block.
 */
function greedyPartition(cells: Coords[]): { blocks: Coords[][]; R: Coords[] } {
  const inSet = new Set(cells.map(c => `${c.row},${c.col}`));
  const used = new Set<string>();
  const blocks: Coords[][] = [];

  const sorted = [...cells].sort((a, b) =>
    a.row !== b.row ? a.row - b.row : a.col - b.col,
  );

  for (const cell of sorted) {
    const k = `${cell.row},${cell.col}`;
    if (used.has(k)) continue;

    const { row: r, col: c } = cell;
    const k01 = `${r},${c + 1}`;
    const k10 = `${r + 1},${c}`;
    const k11 = `${r + 1},${c + 1}`;

    if (
      inSet.has(k01) && !used.has(k01) &&
      inSet.has(k10) && !used.has(k10) &&
      inSet.has(k11) && !used.has(k11)
    ) {
      const block: Coords[] = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];
      blocks.push(block);
      for (const bc of block) used.add(`${bc.row},${bc.col}`);
    }
  }

  return { blocks, R: cells.filter(c => !used.has(`${c.row},${c.col}`)) };
}

/**
 * Maximum number of mutually non-adjacent (8-neighbour) cells that can be
 * selected from `cells`.  Uses branch-and-bound; stops as soon as `stopAt`
 * is reached, since callers only need to know whether α ≥ D.
 *
 * Capped at 30 cells (uses int bitmask).  For larger inputs returns `cells.length`
 * (a trivial upper bound), which makes the deduction safely fail rather than
 * fire spuriously.
 */
function maxIndependentStars(cells: Coords[], stopAt: number): number {
  const n = cells.length;
  if (n === 0) return 0;
  if (stopAt <= 0) return 0;
  if (n > 30) return n;

  const adj: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (
        Math.abs(cells[i].row - cells[j].row) <= 1 &&
        Math.abs(cells[i].col - cells[j].col) <= 1
      ) {
        adj[i] |= 1 << j;
        adj[j] |= 1 << i;
      }
    }
  }

  let best = 0;
  const full = n === 30 ? 0x3fffffff : (1 << n) - 1;

  function popcount(x: number): number {
    let count = 0;
    while (x) {
      x &= x - 1;
      count++;
    }
    return count;
  }

  function dfs(available: number, picked: number): boolean {
    if (picked >= stopAt) {
      best = picked;
      return true;
    }
    if (available === 0) {
      if (picked > best) best = picked;
      return false;
    }
    if (picked + popcount(available) <= best) return false;

    // Pick lowest-numbered available vertex.
    const v = 31 - Math.clz32(available & -available);
    const vBit = 1 << v;

    // Branch 1: take v (removes v and all its neighbours).
    if (dfs(available & ~vBit & ~adj[v], picked + 1)) return true;
    // Branch 2: skip v.
    return dfs(available & ~vBit, picked);
  }

  dfs(full, 0);
  return best;
}

interface BandInfo {
  direction: 'col' | 'row';
  start: number;
  N: number;
  D: number;
  E: Coords[];
  inBand: (cell: Coords) => boolean;
  label: string;
  highlight: { cols?: number[]; rows?: number[] };
  blocks: Coords[][];
  R: Coords[];
}

function describeBand(state: PuzzleState, direction: 'col' | 'row', start: number, N: number): BandInfo | null {
  const { starsPerUnit } = state.def;

  const bandCells: Coords[] = [];
  for (let i = start; i < start + N; i++) {
    bandCells.push(...(direction === 'col' ? colCells(state, i) : rowCells(state, i)));
  }

  const D = N * starsPerUnit - countStars(state, bandCells);
  if (D <= 0) return null;

  const E = emptyCells(state, bandCells);
  if (E.length < D) return null;

  const { blocks, R } = greedyPartition(E);

  const inBand = (cell: Coords): boolean =>
    direction === 'col'
      ? cell.col >= start && cell.col < start + N
      : cell.row >= start && cell.row < start + N;

  const label =
    direction === 'col'
      ? `Column${N > 1 ? `s ${start + 1}–${start + N}` : ` ${start + 1}`}`
      : `Row${N > 1 ? `s ${start + 1}–${start + N}` : ` ${start + 1}`}`;

  const highlight =
    direction === 'col'
      ? { cols: Array.from({ length: N }, (_, i) => start + i) }
      : { rows: Array.from({ length: N }, (_, i) => start + i) };

  return { direction, start, N, D, E, inBand, label, highlight, blocks, R };
}

/** Cheap 2×2-block deduction.  Per-band, returns the first band's hint. */
function stage1Hint(state: PuzzleState, band: BandInfo): Hint | null {
  const { size } = state.def;
  const { D, R, blocks, inBand, label, highlight } = band;
  const m = blocks.length;
  if (D <= m || D - m > R.length) return null;

  const deficit = D - m;
  const rNbSets = R.map(rc => {
    const s = new Set<string>();
    for (const nb of neighbors8(rc, size)) s.add(`${nb.row},${nb.col}`);
    return s;
  });

  const allRMustBeStar = deficit === R.length;
  const forcedCrosses: Coords[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (inBand({ row: r, col: c })) continue;
      if (state.cells[r][c] !== 'empty') continue;

      const key = `${r},${c}`;
      const forced = allRMustBeStar
        ? rNbSets.some(s => s.has(key))
        : rNbSets.every(s => s.has(key));

      if (forced) forcedCrosses.push({ row: r, col: c });
    }
  }

  if (forcedCrosses.length === 0) return null;

  const rLabel = R.map(c => `(${c.row + 1},${c.col + 1})`).join(', ');
  const explanation =
    allRMustBeStar
      ? `${label} need ${D} more star(s). The ${m} 2×2 block(s) supply at most ${m}, ` +
        `so all ${R.length} remaining cell(s) ${rLabel} must be stars — ` +
        `any cell adjacent to any of them is a forced cross.`
      : `${label} need ${D} more star(s). The ${m} 2×2 block(s) supply at most ${m}, ` +
        `so at least ${deficit} star(s) must land in the ${R.length} remaining cell(s) ${rLabel}. ` +
        `Any cell adjacent to all of them is a forced cross.`;

  return {
    id: nextHintId(),
    kind: 'place-cross',
    technique: 'band-deficit',
    resultCells: forcedCrosses,
    explanation,
    highlights: { ...highlight, cells: [...R, ...forcedCrosses] },
  };
}

/**
 * Exact α(E \ N(c)) deduction for a single band.  Returns the list of forced
 * crosses outside the band — empty if none.  An outside empty cell c is
 * forced when α(E \ N(c)) < D, i.e. making c a star would reduce the band's
 * remaining empty-cell capacity below the required D stars.
 */
function stage2ForcedCrosses(state: PuzzleState, band: BandInfo): Coords[] {
  const { size } = state.def;
  const { D, E, inBand } = band;

  if (E.length === 0 || E.length > 30) return [];

  const alphaE = maxIndependentStars(E, D);
  if (alphaE < D) return []; // inconsistency — leave it for other techniques.

  const forced: Coords[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (inBand({ row: r, col: c })) continue;
      if (state.cells[r][c] !== 'empty') continue;

      const E_c = E.filter(e => Math.abs(e.row - r) > 1 || Math.abs(e.col - c) > 1);
      if (E_c.length === E.length) continue;

      if (maxIndependentStars(E_c, D) < D) {
        forced.push({ row: r, col: c });
      }
    }
  }
  return forced;
}

export function findBandDeficitHint(state: PuzzleState): Hint | null {
  const { size } = state.def;

  const bands: BandInfo[] = [];
  for (let N = 2; N < size; N++) {
    for (let start = 0; start + N <= size; start++) {
      const colBand = describeBand(state, 'col', start, N);
      if (colBand) bands.push(colBand);
      const rowBand = describeBand(state, 'row', start, N);
      if (rowBand) bands.push(rowBand);
    }
  }

  // Stage 1: cheap, first-match wins.
  for (const band of bands) {
    const hint = stage1Hint(state, band);
    if (hint) return hint;
  }

  // Stage 2: accumulate forced crosses across every band. Bands often overlap
  // in which outside cells they cover, but each contributes independently —
  // returning them in one hint applies multiple deductions per solver step.
  const seen = new Set<string>();
  const collected: Coords[] = [];
  const contributingBands: BandInfo[] = [];
  const highlightCells: Coords[] = [];

  for (const band of bands) {
    const forced = stage2ForcedCrosses(state, band);
    if (forced.length === 0) continue;

    let added = false;
    for (const c of forced) {
      const k = `${c.row},${c.col}`;
      if (seen.has(k)) continue;
      seen.add(k);
      collected.push(c);
      added = true;
    }
    if (added) {
      contributingBands.push(band);
      for (const e of band.E) highlightCells.push(e);
    }
  }

  if (collected.length === 0) return null;

  const bandLabels = contributingBands.map(b => b.label).join('; ');
  const explanation =
    contributingBands.length === 1
      ? `${contributingBands[0].label} need ${contributingBands[0].D} more star(s); ` +
        `each highlighted cross is a cell whose star would drop the band's ` +
        `remaining capacity below ${contributingBands[0].D}.`
      : `${contributingBands.length} bands (${bandLabels}) each force crosses ` +
        `on cells whose star would drop that band's remaining capacity below ` +
        `the required number of stars.`;

  return {
    id: nextHintId(),
    kind: 'place-cross',
    technique: 'band-deficit',
    resultCells: collected,
    explanation,
    highlights: { cells: [...highlightCells, ...collected] },
  };
}

export function findBandDeficitResult(state: PuzzleState): TechniqueResult {
  const hint = findBandDeficitHint(state);
  if (hint) return { type: 'hint', hint };
  return { type: 'none' };
}
