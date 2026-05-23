import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import { neighbors8 } from '../helpers';

let hintCounter = 0;
function nextHintId() {
  hintCounter += 1;
  return `band-block-deficit-${hintCounter}`;
}

type Orientation = 'col' | 'row';

interface BlockWindow {
  cells: Coords[];
}

interface CoverResult {
  size: number;
  windowCells: Coords[];
}

/**
 * Band Block Deficit
 *
 * In any strip of N consecutive columns (or rows), the strip must contain
 * exactly N * starsPerUnit stars. A 2x2 block holds at most one star, so a
 * collection of k disjoint star-free 2x2 windows entirely inside the strip
 * can absorb at most k of the remaining stars. If those k windows together
 * cover every strip-empty cell that is NOT 8-adjacent to some outside cell C,
 * then at least D - k stars must land in cells adjacent to C — so C cannot
 * be a star.
 *
 * Implemented for N = 2 (consecutive pairs of rows/columns). N = 1 reduces
 * to adjacent-exclusion.
 */
export function findBandBlockDeficitHint(state: PuzzleState): Hint | null {
  for (const orientation of ['col', 'row'] as Orientation[]) {
    for (let start = 0; start <= state.def.size - 2; start += 1) {
      const hint = analyzeStrip(state, orientation, start, 2);
      if (hint) return hint;
    }
  }
  return null;
}

export function findBandBlockDeficitResult(state: PuzzleState): TechniqueResult {
  const hint = findBandBlockDeficitHint(state);
  return hint ? { type: 'hint', hint } : { type: 'none' };
}

function stripCellsOf(state: PuzzleState, orientation: Orientation, start: number, n: number): Coords[] {
  const cells: Coords[] = [];
  const size = state.def.size;
  for (let i = 0; i < size; i += 1) {
    for (let off = 0; off < n; off += 1) {
      const j = start + off;
      cells.push(orientation === 'col' ? { row: i, col: j } : { row: j, col: i });
    }
  }
  return cells;
}

function analyzeStrip(state: PuzzleState, orientation: Orientation, start: number, n: number): Hint | null {
  const { size, starsPerUnit } = state.def;
  const stripCells = stripCellsOf(state, orientation, start, n);

  let stars = 0;
  for (const cell of stripCells) {
    if (state.cells[cell.row][cell.col] === 'star') stars += 1;
  }
  const D = n * starsPerUnit - stars;
  if (D <= 0) return null;

  const empties: Coords[] = [];
  for (const cell of stripCells) {
    if (state.cells[cell.row][cell.col] === 'empty') empties.push(cell);
  }
  if (empties.length === 0) return null;

  const inStrip = (cell: Coords): boolean => {
    if (orientation === 'col') {
      return cell.col >= start && cell.col < start + n;
    }
    return cell.row >= start && cell.row < start + n;
  };

  const windows: BlockWindow[] = [];
  for (let r = 0; r <= size - 2; r += 1) {
    for (let c = 0; c <= size - 2; c += 1) {
      const w: Coords[] = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];
      if (!w.every(inStrip)) continue;
      let hasStar = false;
      let hasEmpty = false;
      for (const cell of w) {
        const s = state.cells[cell.row][cell.col];
        if (s === 'star') hasStar = true;
        else if (s === 'empty') hasEmpty = true;
      }
      if (hasStar) continue;
      if (!hasEmpty) continue;
      windows.push({ cells: w });
    }
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'empty') continue;
      const C: Coords = { row: r, col: c };
      if (inStrip(C)) continue;

      const adjKeys = new Set<string>();
      for (const nb of neighbors8(C, size)) {
        adjKeys.add(`${nb.row},${nb.col}`);
      }

      const eR: Coords[] = [];
      const eF: Coords[] = [];
      for (const e of empties) {
        if (adjKeys.has(`${e.row},${e.col}`)) eR.push(e);
        else eF.push(e);
      }
      if (eR.length === 0) continue;

      const cover = findMinDisjointCover(eF, windows, D - 1);
      if (cover === null) continue;

      return buildHint(state, orientation, start, n, D, stars, eR, eF, cover, C);
    }
  }

  return null;
}

/**
 * Find the smallest set of disjoint windows that covers every cell in
 * `targetCells`, with size at most `maxSize`. Returns null if no such set
 * exists. Each window in `windows` must already be a star-free 2x2 inside
 * the strip.
 */
function findMinDisjointCover(
  targetCells: Coords[],
  windows: BlockWindow[],
  maxSize: number,
): CoverResult | null {
  if (targetCells.length === 0) {
    return { size: 0, windowCells: [] };
  }
  if (maxSize < 1) return null;

  const targetKeys = new Set(targetCells.map((c) => `${c.row},${c.col}`));
  const useful = windows.filter((w) => w.cells.some((cell) => targetKeys.has(`${cell.row},${cell.col}`)));
  if (useful.length === 0) return null;

  const cellIndex = new Map<string, number>();
  for (const w of useful) {
    for (const cell of w.cells) {
      const key = `${cell.row},${cell.col}`;
      if (!cellIndex.has(key)) cellIndex.set(key, cellIndex.size);
    }
  }

  const winCellMask: number[] = useful.map((w) => {
    let m = 0;
    for (const cell of w.cells) {
      m |= 1 << (cellIndex.get(`${cell.row},${cell.col}`) as number);
    }
    return m;
  });

  let targetMask = 0;
  for (const t of targetCells) {
    targetMask |= 1 << (cellIndex.get(`${t.row},${t.col}`) as number);
  }

  const n = useful.length;
  if (n > 16) return null;

  let bestSize = Math.min(maxSize, n) + 1;
  let bestMask = 0;

  const total = 1 << n;
  for (let mask = 1; mask < total; mask += 1) {
    const popCount = popcount(mask);
    if (popCount >= bestSize) continue;

    let used = 0;
    let valid = true;
    for (let i = 0; i < n; i += 1) {
      if ((mask & (1 << i)) === 0) continue;
      if ((used & winCellMask[i]) !== 0) {
        valid = false;
        break;
      }
      used |= winCellMask[i];
    }
    if (!valid) continue;
    if ((used & targetMask) === targetMask) {
      bestSize = popCount;
      bestMask = mask;
    }
  }

  if (bestMask === 0) return null;

  const windowCells: Coords[] = [];
  for (let i = 0; i < n; i += 1) {
    if (bestMask & (1 << i)) windowCells.push(...useful[i].cells);
  }
  return { size: bestSize, windowCells };
}

function popcount(x: number): number {
  let v = x;
  v = v - ((v >> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
  v = (v + (v >> 4)) & 0x0f0f0f0f;
  return (v * 0x01010101) >>> 24;
}

function buildHint(
  state: PuzzleState,
  orientation: Orientation,
  start: number,
  n: number,
  D: number,
  starsPlaced: number,
  eR: Coords[],
  eF: Coords[],
  cover: CoverResult,
  target: Coords,
): Hint {
  const totalRequired = n * state.def.starsPerUnit;
  const indices = Array.from({ length: n }, (_, i) => start + i);
  const stripLabel = orientation === 'col'
    ? (n === 1 ? `Column ${start}` : `Columns ${indices.join('–')}`)
    : (n === 1 ? `Row ${start}` : `Rows ${indices.join('–')}`);

  const surplus = D - cover.size;
  const blockWord = cover.size === 1 ? 'block' : 'blocks';
  const farCount = eF.length;
  const nearCount = eR.length;
  const targetDesc = `(${target.row},${target.col})`;

  const explanation =
    `${stripLabel} must contain ${totalRequired} stars; ${starsPlaced} placed leaves ${D} needed. ` +
    `${cover.size} disjoint star-free 2×2 ${blockWord} cover all ${farCount} empty cell` +
    `${farCount !== 1 ? 's' : ''} not adjacent to ${targetDesc}, ` +
    `so at most ${cover.size} of those stars can fall there. ` +
    `That forces at least ${surplus} star${surplus !== 1 ? 's' : ''} into the ${nearCount} cell` +
    `${nearCount !== 1 ? 's' : ''} adjacent to ${targetDesc}, making it a cross.`;

  const dedup = new Map<string, Coords>();
  const addCells = (cells: Coords[]) => {
    for (const c of cells) dedup.set(`${c.row},${c.col}`, c);
  };
  addCells([target]);
  addCells(eR);
  addCells(eF);
  addCells(cover.windowCells);
  const highlightCells = Array.from(dedup.values());

  const highlights = orientation === 'col'
    ? { cols: indices, cells: highlightCells }
    : { rows: indices, cells: highlightCells };

  return {
    id: nextHintId(),
    kind: 'place-cross',
    technique: 'band-block-deficit',
    resultCells: [target],
    explanation,
    highlights,
  };
}
