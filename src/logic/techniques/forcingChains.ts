import type { PuzzleState, Coords, CellState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, CellDeduction } from '../../types/deductions';
import { neighbors8 } from '../helpers';

/**
 * Depth-1 Forcing Chains:
 *
 * For each candidate empty cell c:
 *   - Star hypothesis: place star at c, propagate constraints. Contradiction → c must be cross.
 *   - Cross hypothesis: place cross at c, propagate constraints. Contradiction → c must be star.
 *
 * "Propagate" means applying to fixed point:
 *   1. Star adjacency → crosses
 *   2. 2×2 single-star → crosses for rest of block
 *   3. Row/col/region quota met → remaining empties become crosses
 *   4. Row/col/region tightness (empty == remaining) → remaining empties become stars
 *
 * Only tests cells that are in constrained units (few empty cells remain) to
 * keep runtime manageable.
 */
export function findForcingChainsHint(_state: PuzzleState): Hint | null {
  return null;
}

export function findForcingChainsResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit, regions } = state.def;
  const deductions: CellDeduction[] = [];
  const seen = new Set<string>();

  // Precompute unit sizes for candidate selection
  const rowEmpty = new Array(size).fill(0);
  const colEmpty = new Array(size).fill(0);
  const regionEmpty = new Map<number, number>();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (state.cells[r][c] === 'empty') {
        rowEmpty[r]++;
        colEmpty[c]++;
        const rid = regions[r][c];
        regionEmpty.set(rid, (regionEmpty.get(rid) ?? 0) + 1);
      }
    }
  }

  // Only test cells in constrained units (≤ 4 empty) to limit cost
  const CONSTRAINT_THRESHOLD = 4;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (state.cells[r][c] !== 'empty') continue;
      const rid = regions[r][c];
      const isConstrained =
        rowEmpty[r] <= CONSTRAINT_THRESHOLD ||
        colEmpty[c] <= CONSTRAINT_THRESHOLD ||
        (regionEmpty.get(rid) ?? 0) <= CONSTRAINT_THRESHOLD;
      if (!isConstrained) continue;

      const key = `${r},${c}`;

      // Star hypothesis
      const starResult = propagate(state, r, c, 'star');
      if (starResult === null) {
        if (!seen.has(`E:${key}`)) {
          seen.add(`E:${key}`);
          deductions.push({
            kind: 'cell',
            type: 'forceEmpty',
            cell: { row: r, col: c },
            technique: 'forcing-chains',
            explanation: `Forcing chains: placing a star at (${r},${c}) leads to a contradiction.`,
          });
        }
        continue; // Cross hypothesis moot if star already ruled out
      }

      // Cross hypothesis
      const crossResult = propagate(state, r, c, 'cross');
      if (crossResult === null) {
        if (!seen.has(`S:${key}`)) {
          seen.add(`S:${key}`);
          deductions.push({
            kind: 'cell',
            type: 'forceStar',
            cell: { row: r, col: c },
            technique: 'forcing-chains',
            explanation: `Forcing chains: placing a cross at (${r},${c}) leads to a contradiction.`,
          });
        }
      }
    }
  }

  if (deductions.length > 0) return { type: 'deductions', deductions };
  return { type: 'none' };
}

/**
 * Clone the board, apply the hypothesis at (row,col), propagate to fixed point.
 * Returns final cells array on success, null on contradiction.
 */
function propagate(
  state: PuzzleState,
  row: number,
  col: number,
  value: 'star' | 'cross',
): CellState[][] | null {
  const { size, starsPerUnit, regions } = state.def;
  const cells: CellState[][] = state.cells.map((r) => [...r]);

  if (cells[row][col] !== 'empty') return null;
  cells[row][col] = value;

  const MAX_ITER = 10;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false;

    // 1. Star adjacency → crosses; adjacent stars → contradiction
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (cells[r][c] !== 'star') continue;
        for (const nb of neighbors8({ row: r, col: c }, size)) {
          if (cells[nb.row][nb.col] === 'star' && (nb.row !== r || nb.col !== c)) return null;
          if (cells[nb.row][nb.col] === 'empty') {
            cells[nb.row][nb.col] = 'cross';
            changed = true;
          }
        }
      }
    }

    // 2. 2×2: at most one star per 2×2 window
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        let stars = 0;
        const empties: Coords[] = [];
        for (const b of [
          { row: r, col: c }, { row: r, col: c + 1 },
          { row: r + 1, col: c }, { row: r + 1, col: c + 1 },
        ]) {
          if (cells[b.row][b.col] === 'star') stars++;
          else if (cells[b.row][b.col] === 'empty') empties.push(b);
        }
        if (stars > 1) return null;
        if (stars === 1) {
          for (const e of empties) { cells[e.row][e.col] = 'cross'; changed = true; }
        }
      }
    }

    // 3. Row quota & tightness
    for (let r = 0; r < size; r++) {
      let stars = 0;
      const emptyList: Coords[] = [];
      for (let c = 0; c < size; c++) {
        if (cells[r][c] === 'star') stars++;
        else if (cells[r][c] === 'empty') emptyList.push({ row: r, col: c });
      }
      if (stars > starsPerUnit) return null;
      if (stars + emptyList.length < starsPerUnit) return null;
      if (stars === starsPerUnit && emptyList.length > 0) {
        for (const e of emptyList) { cells[e.row][e.col] = 'cross'; changed = true; }
      } else if (starsPerUnit - stars === emptyList.length && emptyList.length > 0) {
        for (const e of emptyList) { cells[e.row][e.col] = 'star'; changed = true; }
      }
    }

    // 4. Column quota & tightness
    for (let c = 0; c < size; c++) {
      let stars = 0;
      const emptyList: Coords[] = [];
      for (let r = 0; r < size; r++) {
        if (cells[r][c] === 'star') stars++;
        else if (cells[r][c] === 'empty') emptyList.push({ row: r, col: c });
      }
      if (stars > starsPerUnit) return null;
      if (stars + emptyList.length < starsPerUnit) return null;
      if (stars === starsPerUnit && emptyList.length > 0) {
        for (const e of emptyList) { cells[e.row][e.col] = 'cross'; changed = true; }
      } else if (starsPerUnit - stars === emptyList.length && emptyList.length > 0) {
        for (const e of emptyList) { cells[e.row][e.col] = 'star'; changed = true; }
      }
    }

    // 5. Region quota & tightness
    const regionStars = new Map<number, number>();
    const regionEmpties = new Map<number, Coords[]>();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const id = regions[r][c];
        if (cells[r][c] === 'star') {
          regionStars.set(id, (regionStars.get(id) ?? 0) + 1);
        } else if (cells[r][c] === 'empty') {
          if (!regionEmpties.has(id)) regionEmpties.set(id, []);
          regionEmpties.get(id)!.push({ row: r, col: c });
        }
      }
    }
    for (const [id, stars] of regionStars) {
      const empties = regionEmpties.get(id) ?? [];
      if (stars > starsPerUnit) return null;
      if (stars + empties.length < starsPerUnit) return null;
      if (stars === starsPerUnit && empties.length > 0) {
        for (const e of empties) { cells[e.row][e.col] = 'cross'; changed = true; }
      } else if (starsPerUnit - stars === empties.length && empties.length > 0) {
        for (const e of empties) { cells[e.row][e.col] = 'star'; changed = true; }
      }
    }
    for (const [id, empties] of regionEmpties) {
      if (regionStars.has(id)) continue;
      if (empties.length < starsPerUnit) return null;
      if (starsPerUnit === empties.length) {
        for (const e of empties) { cells[e.row][e.col] = 'star'; changed = true; }
      }
    }

    if (!changed) break;
  }

  return cells;
}
