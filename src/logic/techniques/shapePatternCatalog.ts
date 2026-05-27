/**
 * Pre-computed pattern catalog for common star-battle shapes.
 *
 * For each canonical shape (normalized to min row/col = 0, across all 8
 * rigid-body orientations), we pre-compute:
 *   forcedStars   – shape cells that appear in EVERY valid star placement
 *   forcedCrosses – outside cells adjacent to a star in EVERY valid placement
 *
 * At runtime this gives O(1) lookup instead of running enumeration per hint.
 * Shapes not in the catalog fall through to the general enumeration path.
 *
 * Base shapes are defined in one canonical orientation; all 8 isometries of the
 * square are generated automatically.
 */

export interface PatternResult {
  forcedStars: [number, number][];   // in normalized (0-based) space
  forcedCrosses: [number, number][]; // outside cells, in normalized space
}

// 8 rigid transformations (4 rotations × 2 mirrors)
const ISOMETRIES: Array<(r: number, c: number) => [number, number]> = [
  (r, c) => [r, c],
  (r, c) => [c, -r],
  (r, c) => [-r, -c],
  (r, c) => [-c, r],
  (r, c) => [r, -c],
  (r, c) => [-c, -r],
  (r, c) => [-r, c],
  (r, c) => [c, r],
];

function normalize(cells: [number, number][]): { cells: [number, number][]; key: string } {
  const minR = Math.min(...cells.map((c) => c[0]));
  const minC = Math.min(...cells.map((c) => c[1]));
  const shifted = cells.map(([r, c]) => [r - minR, c - minC] as [number, number]);
  shifted.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return {
    cells: shifted,
    key: shifted.map(([r, c]) => `${r},${c}`).join('|'),
  };
}

function enumeratePlacements(cells: [number, number][], count: number): [number, number][][] {
  if (count === 0) return [[]];
  if (cells.length < count) return [];
  const results: [number, number][][] = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const remaining = cells
      .slice(i + 1)
      .filter((c) => Math.abs(c[0] - cell[0]) > 1 || Math.abs(c[1] - cell[1]) > 1);
    for (const sub of enumeratePlacements(remaining, count - 1)) {
      results.push([cell, ...sub]);
    }
  }
  return results;
}

function computePattern(cells: [number, number][], starsNeeded: number): PatternResult | null {
  const placements = enumeratePlacements(cells, starsNeeded);
  if (placements.length === 0) return null;

  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));

  // Forced stars: appear in every placement
  const forcedStars = cells.filter(([r, c]) =>
    placements.every((pl) => pl.some(([sr, sc]) => sr === r && sc === c)),
  );

  // Forced outside crosses: cells not in shape that are adjacent to a star in every placement
  const outsideCandidates = new Map<string, [number, number]>();
  for (const pl of placements) {
    for (const [sr, sc] of pl) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const key = `${sr + dr},${sc + dc}`;
          if (!cellSet.has(key)) outsideCandidates.set(key, [sr + dr, sc + dc]);
        }
      }
    }
  }

  const forcedCrosses: [number, number][] = [];
  for (const [[r, c]] of [...outsideCandidates].map(([, v]) => [v] as [[number, number]])) {
    const inAll = placements.every((pl) =>
      pl.some(([sr, sc]) => Math.abs(sr - r) <= 1 && Math.abs(sc - c) <= 1),
    );
    if (inAll) forcedCrosses.push([r, c]);
  }

  // In-shape cells that never appear in any valid placement are also forced crosses
  // (e.g. the bottom-middle of a U-pentomino with 2 stars).
  for (const [r, c] of cells) {
    const everPlaced = placements.some((pl) => pl.some(([sr, sc]) => sr === r && sc === c));
    if (!everPlaced) forcedCrosses.push([r, c]);
  }

  return { forcedStars, forcedCrosses };
}

/**
 * Base shapes (one canonical orientation each). All 8 isometries are auto-generated.
 * Grouped by cell count for readability.
 */
const BASE_SHAPES: Array<{ name: string; cells: [number, number][] }> = [
  // ── 2 cells ─────────────────────────────────────────────────────────────────
  { name: '1×2',      cells: [[0,0],[0,1]] },

  // ── 3 cells ─────────────────────────────────────────────────────────────────
  { name: '1×3',      cells: [[0,0],[0,1],[0,2]] },
  { name: 'L-tromino', cells: [[0,0],[0,1],[1,0]] }, // corner piece

  // ── 4 cells (tetrominoes) ────────────────────────────────────────────────────
  { name: 'I-tetromino', cells: [[0,0],[0,1],[0,2],[0,3]] },
  { name: 'L-tetromino', cells: [[0,0],[1,0],[2,0],[2,1]] },
  { name: 'T-tetromino', cells: [[0,0],[0,1],[0,2],[1,1]] },
  { name: 'S-tetromino', cells: [[0,0],[0,1],[1,1],[1,2]] },
  // O-tetromino (2×2) omitted — all pairs 8-adjacent, no valid placement

  // ── 5 cells (pentominoes) ────────────────────────────────────────────────────
  { name: 'I-pentomino', cells: [[0,0],[0,1],[0,2],[0,3],[0,4]] },
  { name: 'L-pentomino', cells: [[0,0],[1,0],[2,0],[3,0],[3,1]] },
  { name: 'Y-pentomino', cells: [[0,0],[1,0],[1,1],[2,0],[3,0]] },
  { name: 'N-pentomino', cells: [[0,0],[1,0],[1,1],[2,1],[3,1]] },
  { name: 'P-pentomino', cells: [[0,0],[0,1],[1,0],[1,1],[2,0]] },
  { name: 'F-pentomino', cells: [[0,1],[0,2],[1,0],[1,1],[2,1]] },
  { name: 'T-pentomino', cells: [[0,0],[0,1],[0,2],[1,1],[2,1]] },
  { name: 'U-pentomino', cells: [[0,0],[0,1],[0,2],[1,0],[1,2]] },
  { name: 'V-pentomino', cells: [[0,0],[1,0],[2,0],[2,1],[2,2]] },
  { name: 'W-pentomino', cells: [[0,0],[1,0],[1,1],[2,1],[2,2]] },
  { name: 'X-pentomino', cells: [[0,1],[1,0],[1,1],[1,2],[2,1]] },
  { name: 'Z-pentomino', cells: [[0,0],[0,1],[1,1],[2,1],[2,2]] },

  // ── 6 cells (hexominoes — strips and common shapes) ──────────────────────────
  { name: '1×6',       cells: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]] },
  { name: 'L-hexomino', cells: [[0,0],[1,0],[2,0],[3,0],[4,0],[4,1]] },
  { name: 'rect-2×3',   cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]] },
];

/**
 * Catalog keyed by canonical cell string → computed deductions (per starsPerUnit).
 * starsPerUnit is almost always 2, but we index by it just in case.
 */
const catalogByStars = new Map<number, Map<string, PatternResult>>();

function getOrBuildCatalog(starsPerUnit: number): Map<string, PatternResult> {
  const existing = catalogByStars.get(starsPerUnit);
  if (existing) return existing;

  const map = new Map<string, PatternResult>();

  for (const { cells } of BASE_SHAPES) {
    for (const iso of ISOMETRIES) {
      const transformed = cells.map(([r, c]) => iso(r, c));
      const { cells: norm, key } = normalize(transformed);
      if (map.has(key)) continue;
      const result = computePattern(norm, starsPerUnit);
      if (result) map.set(key, result);
    }
  }

  catalogByStars.set(starsPerUnit, map);
  return map;
}

/**
 * Look up a region's cells in the catalog.
 *
 * @param regionCells  The actual (absolute) coords of region cells to match.
 * @param starsNeeded  How many stars must go in this region (starsPerUnit - already placed).
 * @returns The deduction in ABSOLUTE coordinates, or null if no catalog entry.
 */
export function lookupPattern(
  regionCells: [number, number][],
  starsNeeded: number,
): PatternResult | null {
  if (regionCells.length < 2 || regionCells.length > 6) return null;
  if (starsNeeded <= 0 || starsNeeded > regionCells.length) return null;

  const catalog = getOrBuildCatalog(starsNeeded);
  const { cells: norm, key } = normalize(regionCells);
  const entry = catalog.get(key);
  if (!entry) return null;

  // Map deductions back to absolute coordinates.
  // The normalize() of regionCells gives us the same offset used for the key,
  // so norm[i] corresponds to regionCells in sorted order (by row then col).
  // Build a coord-to-absolute map.
  const minR = Math.min(...regionCells.map((c) => c[0]));
  const minC = Math.min(...regionCells.map((c) => c[1]));

  const toAbsolute = ([r, c]: [number, number]): [number, number] => [r + minR, c + minC];

  // Sanity check: the normalized cells must match what we stored
  const normKey = norm.map(([r, c]) => `${r},${c}`).join('|');
  if (normKey !== key) return null;

  return {
    forcedStars: entry.forcedStars.map(toAbsolute),
    forcedCrosses: entry.forcedCrosses.map(toAbsolute),
  };
}

/** Exposed for tests / debugging. */
export function getCatalogSize(starsPerUnit: number): number {
  return getOrBuildCatalog(starsPerUnit).size;
}
