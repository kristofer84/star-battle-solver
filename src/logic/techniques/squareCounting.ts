import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, BlockDeduction } from '../../types/deductions';
import {
  rowCells,
  colCells,
  countStars,
  emptyCells,
  getCell,
  formatRow,
  formatCol,
} from '../helpers';
import { canPlaceAllStarsSimultaneously } from '../constraints/placement';

let hintCounter = 0;
function nextHintId() {
  hintCounter += 1;
  return `square-counting-${hintCounter}`;
}

type BandKind = 'rows' | 'cols';

function formatUnitList(indices: number[], formatter: (n: number) => string): string {
  if (indices.length === 0) return '';
  if (indices.length === 1) return formatter(indices[0]);
  if (indices.length === 2) return `${formatter(indices[0])} and ${formatter(indices[1])}`;
  const last = indices[indices.length - 1];
  const rest = indices.slice(0, -1);
  return `${rest.map(formatter).join(', ')}, and ${formatter(last)}`;
}

// --- Fast index helpers ---
function idxOf(size: number, r: number, c: number): number {
  return r * size + c;
}
function coordsOf(size: number, idx: number): Coords {
  return { row: Math.floor(idx / size), col: idx % size };
}

// Adjacency (8-neighbor) mask for candidate-candidate pruning
function areAdjacent8(size: number, aIdx: number, bIdx: number): boolean {
  const ar = Math.floor(aIdx / size);
  const ac = aIdx % size;
  const br = Math.floor(bIdx / size);
  const bc = bIdx % size;
  const dr = ar - br;
  const dc = ac - bc;
  return dr >= -1 && dr <= 1 && dc >= -1 && dc <= 1;
}

// --- Bitmask key for caching (no sorting / no array copies) ---
type Mask = Uint32Array;

function makeMask(words: number): Mask {
  return new Uint32Array(words);
}
function setBit(mask: Mask, bit: number): void {
  mask[bit >>> 5] |= 1 << (bit & 31);
}
function clearBit(mask: Mask, bit: number): void {
  mask[bit >>> 5] &= ~(1 << (bit & 31));
}
function maskKey(mask: Mask): string {
  // WORDS is tiny (<= 4 for 10x10); this is fast and allocation-light
  let s = '';
  for (let i = 0; i < mask.length; i += 1) s += `${mask[i].toString(16)},`;
  return s;
}

// --- Band blocks in linear positions (no overlap checks needed) ---
type BlockAtPos = {
  // 4 cells (indices) in the 2x2 block
  cells: [number, number, number, number];
  // placeable star cells within block (indices)
  placeable: number[];
} | null;

// Evaluate a 2-row or 2-col band using a linear DFS with pruning.
// It counts all valid arrangements, forced stars, and whether the chosen block-set is unique.
type BandEval = {
  remainingStars: number;
  forcedStars: Coords[];
  allBlockCells: Coords[];
  uniqueBlockSetTopLefts: Coords[] | null; // top-left coords of blocks if unique
};

function evaluateBandFast(
  state: PuzzleState,
  kind: BandKind,
  units: [number, number],
  blocksByPos: BlockAtPos[],
  singleOk: Uint8Array,
): BandEval | null {
  const { size, starsPerUnit } = state.def;

  // Count stars needed in these units
  const totalStarsNeeded = 2 * starsPerUnit;
  let totalStarsPlaced = 0;
  for (const u of units) {
    const cells = kind === 'rows' ? rowCells(state, u) : colCells(state, u);
    totalStarsPlaced += countStars(state, cells);
  }
  const remainingStars = totalStarsNeeded - totalStarsPlaced;
  if (remainingStars <= 0) return null;

  const W = blocksByPos.length; // = size - 1
  // Quick impossibility bound: max non-overlapping blocks from a suffix with gap>=2 is ceil(len/2)
  if (Math.ceil(W / 2) < remainingStars) return null;

  // Row/Col current counts for cheap pruning
  const rowPlaced = new Uint8Array(size);
  const colPlaced = new Uint8Array(size);
  for (let r = 0; r < size; r += 1) {
    // Not using helpers here; getCell is already available
    for (let c = 0; c < size; c += 1) {
      if (getCell(state, { row: r, col: c }) === 'star') {
        rowPlaced[r] += 1;
        colPlaced[c] += 1;
      }
    }
  }

  // Accumulators for results
  const totalByCell = new Uint32Array(size * size);
  let totalArrangements = 0;

  // Unique block-set tracking (over block positions, not cells)
  let uniquePossible = true;
  let firstBlockMask = 0n;
  // If W can be > 63, fall back to string mask; but typical boards are <= 20.
  const useBigIntBlockMask = W <= 63;

  // Chosen state for DFS
  const chosenCells: number[] = [];
  const chosenMaskWords = Math.ceil((size * size) / 32);
  const chosenMask = makeMask(chosenMaskWords);
  const feasibleCache = new Map<string, boolean>(); // chosenCells mask -> feasible?

  const chosenBlockPositions: number[] = []; // positions taken (for unique set)
  const incRow = new Uint8Array(size);
  const incCol = new Uint8Array(size);

  function upperBoundFrom(pos: number): number {
    // Maximum number of blocks we can still take starting at pos with step >=2
    const len = W - pos;
    return (len + 1) >> 1;
  }

  function isCellAllowed(idx: number): boolean {
    if (!singleOk[idx]) return false;

    const r = Math.floor(idx / size);
    const c = idx % size;

    // Cheap row/col cap check
    if (rowPlaced[r] + incRow[r] + 1 > starsPerUnit) return false;
    if (colPlaced[c] + incCol[c] + 1 > starsPerUnit) return false;

    // Cheap adjacency among newly chosen stars
    for (let i = 0; i < chosenCells.length; i += 1) {
      if (areAdjacent8(size, idx, chosenCells[i])) return false;
    }
    return true;
  }

  function globalFeasible(): boolean {
    const key = maskKey(chosenMask);
    const cached = feasibleCache.get(key);
    if (cached !== undefined) return cached;

    const coords = chosenCells.map(i => coordsOf(size, i));
    const ok = canPlaceAllStarsSimultaneously(state, coords, starsPerUnit) !== null;
    feasibleCache.set(key, ok);
    return ok;
  }

  function onValidArrangement(): void {
    // Final global check only at full depth
    if (!globalFeasible()) return;

    totalArrangements += 1;
    for (let i = 0; i < chosenCells.length; i += 1) totalByCell[chosenCells[i]] += 1;

    if (uniquePossible) {
      if (useBigIntBlockMask) {
        let bm = 0n;
        for (let i = 0; i < chosenBlockPositions.length; i += 1) {
          bm |= 1n << BigInt(chosenBlockPositions[i]);
        }
        if (totalArrangements === 1) {
          firstBlockMask = bm;
        } else if (bm !== firstBlockMask) {
          uniquePossible = false;
        }
      } else {
        // If board is huge, disable unique-block deductions rather than slowing down.
        uniquePossible = false;
      }
    }
  }

  function dfs(pos: number, starsLeft: number): void {
    if (starsLeft === 0) {
      onValidArrangement();
      return;
    }
    if (pos >= W) return;

    // Prune: not enough positions left even if we take every other one
    if (upperBoundFrom(pos) < starsLeft) return;

    // Option 1: skip this position
    dfs(pos + 1, starsLeft);

    // Option 2: take this block and jump by 2 (to avoid overlap)
    const blk = blocksByPos[pos];
    if (!blk) return;

    // Try each placeable cell
    for (let i = 0; i < blk.placeable.length; i += 1) {
      const cellIdx = blk.placeable[i];
      if (!isCellAllowed(cellIdx)) continue;

      // Apply
      chosenCells.push(cellIdx);
      setBit(chosenMask, cellIdx);
      chosenBlockPositions.push(pos);

      const r = Math.floor(cellIdx / size);
      const c = cellIdx % size;
      incRow[r] += 1;
      incCol[c] += 1;

      dfs(pos + 2, starsLeft - 1);

      // Revert
      incRow[r] -= 1;
      incCol[c] -= 1;

      chosenBlockPositions.pop();
      clearBit(chosenMask, cellIdx);
      chosenCells.pop();
    }
  }

  dfs(0, remainingStars);

  if (totalArrangements === 0) return null;

  // Forced stars: appear in every arrangement
  const forcedStars: Coords[] = [];
  for (let idx = 0; idx < totalByCell.length; idx += 1) {
    if (totalByCell[idx] === totalArrangements) forcedStars.push(coordsOf(size, idx));
  }

  // Highlights: all cells that are part of any usable block in this band
  const allBlockCells: Coords[] = [];
  for (let p = 0; p < W; p += 1) {
    const blk = blocksByPos[p];
    if (!blk) continue;
    allBlockCells.push(coordsOf(size, blk.cells[0]));
    allBlockCells.push(coordsOf(size, blk.cells[1]));
    allBlockCells.push(coordsOf(size, blk.cells[2]));
    allBlockCells.push(coordsOf(size, blk.cells[3]));
  }

  // Unique block-set deductions: every valid arrangement uses same block positions
  let uniqueBlockSetTopLefts: Coords[] | null = null;
  if (uniquePossible && useBigIntBlockMask) {
    // Convert block positions in firstBlockMask into top-left coords
    const tops: Coords[] = [];
    for (let p = 0; p < W; p += 1) {
      if ((firstBlockMask & (1n << BigInt(p))) === 0n) continue;
      if (kind === 'rows') {
        tops.push({ row: units[0], col: p });
      } else {
        tops.push({ row: p, col: units[0] });
      }
    }
    uniqueBlockSetTopLefts = tops;
  }

  return { remainingStars, forcedStars, allBlockCells, uniqueBlockSetTopLefts };
}

// Build blocks-by-position for a 2-row band at startRow
function buildRowBlocksByPos(
  state: PuzzleState,
  startRow: number,
  singleOk: Uint8Array,
): BlockAtPos[] {
  const { size } = state.def;
  const W = size - 1;
  const blocks: BlockAtPos[] = new Array(W).fill(null);

  for (let c = 0; c < W; c += 1) {
    const a = idxOf(size, startRow, c);
    const b = idxOf(size, startRow, c + 1);
    const d = idxOf(size, startRow + 1, c);
    const e = idxOf(size, startRow + 1, c + 1);

    // If the block already contains a star, it can't host another
    if (
      getCell(state, coordsOf(size, a)) === 'star' ||
      getCell(state, coordsOf(size, b)) === 'star' ||
      getCell(state, coordsOf(size, d)) === 'star' ||
      getCell(state, coordsOf(size, e)) === 'star'
    ) {
      continue;
    }

    // Placeable cells: empty and individually feasible
    const placeable: number[] = [];
    if (getCell(state, coordsOf(size, a)) === 'empty' && singleOk[a]) placeable.push(a);
    if (getCell(state, coordsOf(size, b)) === 'empty' && singleOk[b]) placeable.push(b);
    if (getCell(state, coordsOf(size, d)) === 'empty' && singleOk[d]) placeable.push(d);
    if (getCell(state, coordsOf(size, e)) === 'empty' && singleOk[e]) placeable.push(e);

    if (placeable.length === 0) continue;
    blocks[c] = { cells: [a, b, d, e], placeable };
  }

  return blocks;
}

// Build blocks-by-position for a 2-col band at startCol
function buildColBlocksByPos(
  state: PuzzleState,
  startCol: number,
  singleOk: Uint8Array,
): BlockAtPos[] {
  const { size } = state.def;
  const W = size - 1;
  const blocks: BlockAtPos[] = new Array(W).fill(null);

  for (let r = 0; r < W; r += 1) {
    const a = idxOf(size, r, startCol);
    const b = idxOf(size, r, startCol + 1);
    const d = idxOf(size, r + 1, startCol);
    const e = idxOf(size, r + 1, startCol + 1);

    if (
      getCell(state, coordsOf(size, a)) === 'star' ||
      getCell(state, coordsOf(size, b)) === 'star' ||
      getCell(state, coordsOf(size, d)) === 'star' ||
      getCell(state, coordsOf(size, e)) === 'star'
    ) {
      continue;
    }

    const placeable: number[] = [];
    if (getCell(state, coordsOf(size, a)) === 'empty' && singleOk[a]) placeable.push(a);
    if (getCell(state, coordsOf(size, b)) === 'empty' && singleOk[b]) placeable.push(b);
    if (getCell(state, coordsOf(size, d)) === 'empty' && singleOk[d]) placeable.push(d);
    if (getCell(state, coordsOf(size, e)) === 'empty' && singleOk[e]) placeable.push(e);

    if (placeable.length === 0) continue;
    blocks[r] = { cells: [a, b, d, e], placeable };
  }

  return blocks;
}

// Compute everything once so hint/result do not duplicate work
function computeSquareCounting(state: PuzzleState): { hint: Hint | null; deductions: Deduction[] } {
  const { size, starsPerUnit } = state.def;

  // Precompute single-cell feasibility once
  const singleOk = new Uint8Array(size * size);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const idx = idxOf(size, r, c);
      if (getCell(state, { row: r, col: c }) !== 'empty') continue;
      // Keep this expensive call once per cell max
      singleOk[idx] = canPlaceAllStarsSimultaneously(state, [{ row: r, col: c }], starsPerUnit) !== null ? 1 : 0;
    }
  }

  const deductions: Deduction[] = [];
  let bestHint: { hint: Hint; score: number } | null = null;

  function considerBand(kind: BandKind, units: [number, number], evalRes: BandEval): void {
    // Hint
    if (evalRes.forcedStars.length > 0) {
      const explanation =
        `${kind === 'rows' ? 'Rows' : 'Columns'} ${
          kind === 'rows'
            ? `${formatRow(units[0])} and ${formatRow(units[1])}`
            : `${formatCol(units[0])} and ${formatCol(units[1])}`
        } need ${evalRes.remainingStars} more star(s). ` +
        `Considering all globally valid placements using ${evalRes.remainingStars} non-overlapping 2×2 block(s), ` +
        `these star(s) are forced: ${evalRes.forcedStars
          .map(c => `(${formatRow(c.row)}, ${formatCol(c.col)})`)
          .join(', ')}.`;

      const candidateHint: Hint = {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'square-counting',
        resultCells: evalRes.forcedStars,
        explanation,
        highlights:
          kind === 'rows'
            ? { rows: units, cells: evalRes.allBlockCells }
            : { cols: units, cells: evalRes.allBlockCells },
      };

      const score = evalRes.forcedStars.length * 100 + evalRes.remainingStars;
      if (!bestHint || score > bestHint.score) bestHint = { hint: candidateHint, score };
    }

    // Deductions: unique block-set => each such 2x2 must contain exactly one star
    if (evalRes.uniqueBlockSetTopLefts && evalRes.uniqueBlockSetTopLefts.length === evalRes.remainingStars) {
      const unitText =
        kind === 'rows'
          ? formatUnitList(units, formatRow)
          : formatUnitList(units, formatCol);

      for (const topLeft of evalRes.uniqueBlockSetTopLefts) {
        const blockDeduction: BlockDeduction = {
          kind: 'block',
          technique: 'square-counting',
          block: { bRow: topLeft.row, bCol: topLeft.col },
          starsRequired: 1,
          explanation:
            `${unitText} need ${evalRes.remainingStars} more star(s). ` +
            `Across all globally valid arrangements using non-overlapping 2×2 block(s), ` +
            `this 2×2 block must contain exactly one star.`,
        };
        deductions.push(blockDeduction);
      }
    }
  }

  // Rows bands
  for (let startRow = 0; startRow <= size - 2; startRow += 1) {
    const rows: [number, number] = [startRow, startRow + 1];
    const blocksByPos = buildRowBlocksByPos(state, startRow, singleOk);
    const evalRes = evaluateBandFast(state, 'rows', rows, blocksByPos, singleOk);
    if (evalRes) considerBand('rows', rows, evalRes);
  }

  // Cols bands
  for (let startCol = 0; startCol <= size - 2; startCol += 1) {
    const cols: [number, number] = [startCol, startCol + 1];
    const blocksByPos = buildColBlocksByPos(state, startCol, singleOk);
    const evalRes = evaluateBandFast(state, 'cols', cols, blocksByPos, singleOk);
    if (evalRes) considerBand('cols', cols, evalRes);
  }

  return { hint: bestHint ? (bestHint as { hint: Hint }).hint : null, deductions };
}

/**
 * 2x2 Square Counting technique (sound / exhaustive, optimized):
 * Uses linear band DFS (no subset enumeration), single-cell feasibility precompute,
 * bitmask caching, and no arrangement object allocation.
 */
export function findSquareCountingHint(state: PuzzleState): Hint | null {
  return computeSquareCounting(state).hint;
}

/**
 * Find result with deductions support (optimized, no duplicate work).
 */
export function findSquareCountingResult(state: PuzzleState): TechniqueResult {
  const { hint, deductions } = computeSquareCounting(state);

  if (hint) {
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }
  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }
  return { type: 'none' };
}
