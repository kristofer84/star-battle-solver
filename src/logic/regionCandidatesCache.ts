/**
 * Region candidate placement cache.
 *
 * For each region, enumerates every valid K-star placement that respects
 * star-adjacency (8-direction) and current board state (skips crossed cells
 * and cells adjacent to existing stars — including stars outside the region).
 *
 * From the placement set we derive:
 *   - forcedStars:   region cells that appear in EVERY placement → must be stars
 *   - forcedInside:  region cells that appear in NO placement → must be crosses
 *   - forcedOutside: halo cells adjacent to a star in EVERY placement → crosses
 *
 * The cache is keyed by (PuzzleDef, regionId) and validated by a per-region
 * signature over the region+halo cell states. When the signature matches the
 * current board, we reuse cached deductions; otherwise we re-enumerate.
 *
 * Callers should check getRegionPlacements(...) === null to detect a region
 * too large for enumeration (see MAX_EMPTY_FOR_ENUMERATION).
 */

import type { PuzzleState, Coords, PuzzleDef } from '../types/puzzle';
import { regionCells } from './helpers';

export interface RegionPlacements {
  regionId: number;
  starsNeeded: number;
  placements: Coords[][];
  forcedStars: Coords[];
  forcedCrossesInside: Coords[];
  forcedCrossesOutside: Coords[];
}

interface CacheEntry {
  signature: string;
  result: RegionPlacements;
}

const _cacheByDef = new WeakMap<PuzzleDef, Map<number, CacheEntry>>();

/** Skip enumeration when the search space is too large. */
const MAX_EMPTY_FOR_ENUMERATION = 20;

function getCacheMap(def: PuzzleDef): Map<number, CacheEntry> {
  let m = _cacheByDef.get(def);
  if (!m) {
    m = new Map<number, CacheEntry>();
    _cacheByDef.set(def, m);
  }
  return m;
}

/** Build the region+halo cell list. Halo = 8-neighbors of region cells that lie outside the region. */
function buildRegionAndHalo(state: PuzzleState, regionId: number): { region: Coords[]; halo: Coords[] } {
  const { size } = state.def;
  const region = regionCells(state, regionId);
  const inRegion = new Set(region.map((c) => c.row * size + c.col));
  const haloSet = new Set<number>();
  for (const c of region) {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = c.row + dr;
        const nc = c.col + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const k = nr * size + nc;
        if (!inRegion.has(k)) haloSet.add(k);
      }
    }
  }
  const halo: Coords[] = [];
  for (const k of haloSet) halo.push({ row: Math.floor(k / size), col: k % size });
  return { region, halo };
}

function signatureFor(state: PuzzleState, region: Coords[], halo: Coords[]): string {
  // Compact: one char per cell ('s'|'x'|'.'), region then halo.
  let s = '';
  for (const c of region) {
    const v = state.cells[c.row][c.col];
    s += v === 'star' ? 's' : v === 'cross' ? 'x' : '.';
  }
  s += '|';
  for (const c of halo) {
    const v = state.cells[c.row][c.col];
    s += v === 'star' ? 's' : v === 'cross' ? 'x' : '.';
  }
  return s;
}

function enumeratePlacements(
  state: PuzzleState,
  regionEmpties: Coords[],
  starsNeeded: number,
  capPlacements: number,
): Coords[][] | null {
  const { size } = state.def;
  // Available cells: empty AND not adjacent to existing star anywhere.
  const available = regionEmpties.filter((c) => {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = c.row + dr;
        const nc = c.col + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (state.cells[nr][nc] === 'star') return false;
      }
    }
    return true;
  });
  if (available.length < starsNeeded) return [];
  if (available.length > MAX_EMPTY_FOR_ENUMERATION) return null;

  const results: Coords[][] = [];
  const chosen: Coords[] = [];

  function backtrack(start: number): boolean {
    if (chosen.length === starsNeeded) {
      results.push([...chosen]);
      return results.length >= capPlacements;
    }
    const remaining = starsNeeded - chosen.length;
    if (available.length - start < remaining) return false;
    for (let i = start; i < available.length; i += 1) {
      const cand = available[i];
      let ok = true;
      for (const p of chosen) {
        if (Math.abs(p.row - cand.row) <= 1 && Math.abs(p.col - cand.col) <= 1) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      chosen.push(cand);
      if (backtrack(i + 1)) return true;
      chosen.pop();
    }
    return false;
  }

  backtrack(0);
  return results;
}

function deriveForced(
  state: PuzzleState,
  region: Coords[],
  placements: Coords[][],
): { forcedStars: Coords[]; forcedCrossesInside: Coords[]; forcedCrossesOutside: Coords[] } {
  const { size } = state.def;
  const regionKey = (c: Coords) => c.row * size + c.col;
  const inRegion = new Set(region.map(regionKey));

  // For each region cell: how many placements include it?
  const inPlacementCount = new Map<number, number>();
  for (const pl of placements) {
    for (const c of pl) {
      const k = regionKey(c);
      inPlacementCount.set(k, (inPlacementCount.get(k) ?? 0) + 1);
    }
  }

  const total = placements.length;
  const forcedStars: Coords[] = [];
  const forcedCrossesInside: Coords[] = [];
  for (const c of region) {
    if (state.cells[c.row][c.col] !== 'empty') continue; // already decided
    const k = regionKey(c);
    const count = inPlacementCount.get(k) ?? 0;
    if (count === total) forcedStars.push(c);
    else if (count === 0) forcedCrossesInside.push(c);
  }

  // Outside crosses: halo cells adjacent to a star in every placement.
  const haloAdjCount = new Map<number, number>();
  for (const pl of placements) {
    const seenThisPl = new Set<number>();
    for (const s of pl) {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const nr = s.row + dr;
          const nc = s.col + dc;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
          const k = nr * size + nc;
          if (inRegion.has(k)) continue;
          if (state.cells[nr][nc] !== 'empty') continue;
          seenThisPl.add(k);
        }
      }
    }
    for (const k of seenThisPl) haloAdjCount.set(k, (haloAdjCount.get(k) ?? 0) + 1);
  }
  const forcedCrossesOutside: Coords[] = [];
  for (const [k, count] of haloAdjCount) {
    if (count === total) {
      forcedCrossesOutside.push({ row: Math.floor(k / size), col: k % size });
    }
  }

  return { forcedStars, forcedCrossesInside, forcedCrossesOutside };
}

/**
 * Returns cached region placements (re-enumerating only if the region+halo
 * signature changed since last cache hit). Returns null if the region's empty
 * count exceeds MAX_EMPTY_FOR_ENUMERATION (caller falls back to general path).
 *
 * starsPerUnit must include in-region stars: starsNeeded = starsPerUnit - placedInRegion.
 * If starsNeeded === 0, returns an empty placement (no deductions to make).
 */
export function getRegionPlacements(state: PuzzleState, regionId: number): RegionPlacements | null {
  const { starsPerUnit } = state.def;
  const { region, halo } = buildRegionAndHalo(state, regionId);
  let placedStars = 0;
  let placedCrosses = 0;
  const empties: Coords[] = [];
  for (const c of region) {
    const v = state.cells[c.row][c.col];
    if (v === 'star') placedStars += 1;
    else if (v === 'cross') placedCrosses += 1;
    else empties.push(c);
  }
  const starsNeeded = starsPerUnit - placedStars;
  if (starsNeeded <= 0) {
    return {
      regionId,
      starsNeeded: 0,
      placements: [[]],
      forcedStars: [],
      forcedCrossesInside: empties, // saturated region: all remaining are crosses
      forcedCrossesOutside: [],
    };
  }

  const signature = `${starsNeeded}/${signatureFor(state, region, halo)}`;
  const cacheMap = getCacheMap(state.def);
  const cached = cacheMap.get(regionId);
  if (cached && cached.signature === signature) return cached.result;

  const CAP = 10000;
  const placements = enumeratePlacements(state, empties, starsNeeded, CAP);
  if (placements === null) return null;
  if (placements.length === 0) {
    const result: RegionPlacements = {
      regionId,
      starsNeeded,
      placements: [],
      forcedStars: [],
      forcedCrossesInside: [],
      forcedCrossesOutside: [],
    };
    cacheMap.set(regionId, { signature, result });
    return result;
  }

  const forced = deriveForced(state, region, placements);
  const result: RegionPlacements = {
    regionId,
    starsNeeded,
    placements,
    forcedStars: forced.forcedStars,
    forcedCrossesInside: forced.forcedCrossesInside,
    forcedCrossesOutside: forced.forcedCrossesOutside,
  };
  cacheMap.set(regionId, { signature, result });
  return result;
}

/**
 * Convenience: does every placement of region's stars include at least one
 * cell from `subset`? If yes, subset must contain ≥1 star → useful for
 * proving 2x2 sub-blocks (or any cell set) "must hold a star".
 */
export function subsetContainsStar(
  state: PuzzleState,
  regionId: number,
  subset: Coords[],
): boolean | null {
  const rp = getRegionPlacements(state, regionId);
  if (rp === null || rp.placements.length === 0) return null;
  const { size } = state.def;
  const subsetKeys = new Set(subset.map((c) => c.row * size + c.col));
  for (const pl of rp.placements) {
    if (!pl.some((c) => subsetKeys.has(c.row * size + c.col))) return false;
  }
  return true;
}

/** Test/debug: cache stats. */
export function getRegionCacheStats(def: PuzzleDef): { entries: number; totalPlacements: number } {
  const m = _cacheByDef.get(def);
  if (!m) return { entries: 0, totalPlacements: 0 };
  let totalPlacements = 0;
  for (const e of m.values()) totalPlacements += e.result.placements.length;
  return { entries: m.size, totalPlacements };
}
