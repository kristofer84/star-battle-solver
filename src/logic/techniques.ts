import type { PuzzleState } from '../types/puzzle';
import type { Hint, TechniqueId } from '../types/hints';
import type { TechniqueResult, Deduction } from '../types/deductions';
import { addLogEntry, store } from '../store/puzzleStore';
import { analyzeDeductionsWithContext } from './mainSolver';
import { filterValidDeductions, mergeDeductions } from './deductionUtils';
import { buildPuzzleCache } from './puzzleCache';
import { findTrivialMarksHint, findTrivialMarksResult } from './techniques/trivialMarks';
import { findLockedLineHint, findLockedLineResult } from './techniques/lockedLine';
import { findSaturationHint, findSaturationResult } from './techniques/saturation';
import { findAdjacentRowColHint, findAdjacentRowColResult } from './techniques/adjacentRowCol';
import { findTwoByTwoHint, findTwoByTwoResult } from './techniques/twoByTwo';
import { findSquareCountingHint, findSquareCountingResult } from './techniques/squareCounting';
import { findCrossPressureHint, findCrossPressureResult } from './techniques/crossPressure';
import { findCrossEmptyPatternsHint, findCrossEmptyPatternsResult } from './techniques/crossEmptyPatterns';
import { findSharedRowColumnHint, findSharedRowColumnResult } from './techniques/sharedRowColumn';
import { findExactFillHint, findExactFillResult } from './techniques/exactFill';
import { findExclusionHint, findExclusionResult } from './techniques/exclusion';
import { findPressuredExclusionHint, findPressuredExclusionResult } from './techniques/pressuredExclusion';
import { findAdjacentExclusionHint, findAdjacentExclusionResult } from './techniques/adjacentExclusion';
import { findBandBlockDeficitHint, findBandBlockDeficitResult } from './techniques/bandBlockDeficit';
import { findForcedPlacementHint, findForcedPlacementResult } from './techniques/forcedPlacement';
import { findLineCaseSplitHint, findLineCaseSplitResult } from './techniques/lineCaseSplit';
import { findSimpleShapesHint, findSimpleShapesResult } from './techniques/simpleShapes';
import { findUndercountingHint, findUndercountingResult, findPartialUndercountingHint, findPartialUndercountingResult } from './techniques/undercounting';
import { findOvercountingHint, findOvercountingResult, findPartialOvercountingHint, findPartialOvercountingResult, findLockedOutsideFootprintHint, findLockedOutsideFootprintResult } from './techniques/overcounting';
import { findFinnedCountsHint, findFinnedCountsResult } from './techniques/finnedCounts';
import { findCompositeShapesHint, findCompositeShapesResult } from './techniques/compositeShapes';
import { findSqueezeHint, findSqueezeResult } from './techniques/squeeze';
import { findSetDifferentialsHint, findSetDifferentialsResult } from './techniques/setDifferentials';
import { findByAThreadHint, findByAThreadResult } from './techniques/byAThread';
import { findAtSeaHint, findAtSeaResult } from './techniques/atSea';
import { findByAThreadAtSeaHint, findByAThreadAtSeaResult } from './techniques/byAThreadAtSea';
import { findKissingLsHint, findKissingLsResult } from './techniques/kissingLs';
import { findTheMHint, findTheMResult } from './techniques/theM';
import { findPressuredTsHint, findPressuredTsResult } from './techniques/pressuredTs';
import { findFishHint, findFishResult } from './techniques/fish';
import { findNRooksHint, findNRooksResult } from './techniques/nRooks';
import { findEntanglementHint, findEntanglementResult } from './techniques/entanglement';
import { findEntanglementPatternHint, findEntanglementPatternResult } from './techniques/entanglementPatterns';
import { findSchemaBasedHint, findSchemaBasedResult } from './techniques/schemaBased';
import { findRegionCandidatesHint, findRegionCandidatesResult } from './techniques/regionCandidates';
import { findForcingChainsHint, findForcingChainsResult } from './techniques/forcingChains';

export interface Technique {
  id: TechniqueId;
  name: string;
  /** When true, a single RAF yield is inserted before running so the UI can paint. */
  expensive?: boolean;
  findHint(state: PuzzleState): Hint | null | Promise<Hint | null>;
  findResult?(state: PuzzleState): TechniqueResult | Promise<TechniqueResult>;
}

/**
 * Techniques in difficulty order.
 *
 * Ordering principles:
 *   1. Basics (trivial, cheap, always applicable) first.
 *   2. Exclusion-family before counting — they're still O(n²) and very effective.
 *   3. Counting techniques (undercounting→set-differentials) in middle.
 *   4. Shape/pattern idiosyncrasies after counting.
 *   5. Expensive search techniques (entanglement, by-a-thread) last.
 *
 * entanglement was previously at position 9, before exclusion (#15). That was wrong:
 * exclusion is O(n²) and must-fire first; entanglement is O(n³+) and should only run
 * when simpler deductions are exhausted.
 */
export const techniquesInOrder: Technique[] = [
  // ── Basics ──────────────────────────────────────────────────────────────────
  {
    id: 'trivial-marks',
    name: 'Trivial Marks',
    findHint: findTrivialMarksHint,
    findResult: findTrivialMarksResult,
  },
  {
    id: 'locked-line',
    name: 'Locked Row/Column',
    findHint: findLockedLineHint,
    findResult: findLockedLineResult,
  },
  {
    id: 'saturation',
    name: 'Saturation',
    findHint: findSaturationHint,
    findResult: findSaturationResult,
  },
  {
    id: 'adjacent-row-col',
    name: 'Adjacent Row/Column',
    findHint: findAdjacentRowColHint,
    findResult: findAdjacentRowColResult,
  },
  {
    id: 'two-by-two',
    name: '2×2 Blocks',
    findHint: findTwoByTwoHint,
    findResult: findTwoByTwoResult,
  },
  {
    id: 'exact-fill',
    name: 'Exact Fill',
    findHint: findExactFillHint,
    findResult: findExactFillResult,
  },
  {
    id: 'simple-shapes',
    name: 'Simple Shapes',
    findHint: findSimpleShapesHint,
    findResult: findSimpleShapesResult,
  },
  // ── Exclusion family ────────────────────────────────────────────────────────
  {
    id: 'exclusion',
    name: 'Exclusion',
    findHint: findExclusionHint,
    findResult: findExclusionResult,
  },
  {
    id: 'pressured-exclusion',
    name: 'Pressured Exclusion',
    expensive: true,
    findHint: findPressuredExclusionHint,
    findResult: findPressuredExclusionResult,
  },
  {
    id: 'adjacent-exclusion',
    name: 'Adjacent Exclusion',
    expensive: true,
    findHint: findAdjacentExclusionHint,
    findResult: findAdjacentExclusionResult,
  },
  {
    id: 'band-block-deficit',
    name: 'Band Block Deficit',
    findHint: findBandBlockDeficitHint,
    findResult: findBandBlockDeficitResult,
  },
  {
    id: 'shared-row-column',
    name: 'Shared Row/Column',
    expensive: true,
    findHint: findSharedRowColumnHint,
    findResult: findSharedRowColumnResult,
  },
  {
    id: 'cross-empty-patterns',
    name: 'Cross-Empty Patterns',
    findHint: findCrossEmptyPatternsHint,
    findResult: findCrossEmptyPatternsResult,
  },
  {
    id: 'cross-pressure',
    name: 'Cross Pressure',
    findHint: findCrossPressureHint,
    findResult: findCrossPressureResult,
  },
  {
    id: 'forced-placement',
    name: 'Forced Placement',
    findHint: findForcedPlacementHint,
    findResult: findForcedPlacementResult,
  },
  {
    id: 'line-case-split',
    name: 'Line Case-Split',
    expensive: true,
    findHint: findLineCaseSplitHint,
    findResult: findLineCaseSplitResult,
  },
  {
    id: 'region-candidates',
    name: 'Region Candidates',
    expensive: true,
    findHint: findRegionCandidatesHint,
    findResult: findRegionCandidatesResult,
  },
  {
    id: 'forcing-chains',
    name: 'Forcing Chains',
    expensive: true,
    findHint: findForcingChainsHint,
    findResult: findForcingChainsResult,
  },
  // ── Counting ────────────────────────────────────────────────────────────────
  {
    id: 'undercounting',
    name: 'Undercounting',
    expensive: true,
    findHint: findUndercountingHint,
    findResult: findUndercountingResult,
  },
  {
    id: 'partial-undercounting',
    name: 'Partial Undercounting',
    expensive: true,
    findHint: findPartialUndercountingHint,
    findResult: findPartialUndercountingResult,
  },
  {
    id: 'overcounting',
    name: 'Overcounting',
    expensive: true,
    findHint: findOvercountingHint,
    findResult: findOvercountingResult,
  },
  {
    id: 'partial-overcounting',
    name: 'Partial Overcounting',
    expensive: true,
    findHint: findPartialOvercountingHint,
    findResult: findPartialOvercountingResult,
  },
  {
    id: 'locked-outside-footprint',
    name: 'Locked Outside Footprint',
    expensive: true,
    findHint: findLockedOutsideFootprintHint,
    findResult: findLockedOutsideFootprintResult,
  },
  {
    id: 'square-counting',
    name: 'Square Counting',
    expensive: true,
    findHint: findSquareCountingHint,
    findResult: findSquareCountingResult,
  },
  {
    id: 'finned-counts',
    name: 'Finned Counts',
    expensive: true,
    findHint: findFinnedCountsHint,
    findResult: findFinnedCountsResult,
  },
  {
    id: 'composite-shapes',
    name: 'Composite Shapes',
    expensive: true,
    findHint: findCompositeShapesHint,
    findResult: findCompositeShapesResult,
  },
  {
    id: 'squeeze',
    name: 'Squeeze',
    expensive: true,
    findHint: findSqueezeHint,
    findResult: findSqueezeResult,
  },
  {
    id: 'set-differentials',
    name: 'Set Differentials',
    expensive: true,
    findHint: findSetDifferentialsHint,
    findResult: findSetDifferentialsResult,
  },
  // ── Shape / pattern idiosyncrasies ──────────────────────────────────────────
  {
    id: 'at-sea',
    name: 'At Sea',
    expensive: true,
    findHint: findAtSeaHint,
    findResult: findAtSeaResult,
  },
  {
    id: 'kissing-ls',
    name: 'Kissing Ls',
    expensive: true,
    findHint: findKissingLsHint,
    findResult: findKissingLsResult,
  },
  {
    id: 'the-m',
    name: 'The M',
    expensive: true,
    findHint: findTheMHint,
    findResult: findTheMResult,
  },
  {
    id: 'pressured-ts',
    name: 'Pressured Ts',
    expensive: true,
    findHint: findPressuredTsHint,
    findResult: findPressuredTsResult,
  },
  {
    id: 'fish',
    name: 'Fish',
    expensive: true,
    findHint: findFishHint,
    findResult: findFishResult,
  },
  {
    id: 'n-rooks',
    name: 'N Rooks',
    expensive: true,
    findHint: findNRooksHint,
    findResult: findNRooksResult,
  },
  {
    id: 'schema-based',
    name: 'Schema-Based Logic',
    expensive: true,
    findHint: findSchemaBasedHint,
    findResult: findSchemaBasedResult,
  },
  {
    id: 'entanglement-patterns',
    name: 'Entanglement Patterns',
    expensive: true,
    findHint: findEntanglementPatternHint,
    findResult: findEntanglementPatternResult,
  },
  // ── Expensive search (moved from position 9 to here) ────────────────────────
  {
    id: 'entanglement',
    name: 'Entanglement',
    expensive: true,
    findHint: findEntanglementHint,
    findResult: findEntanglementResult,
  },
  // ── Uniqueness (most expensive — backtracking solvers) ──────────────────────
  {
    id: 'by-a-thread',
    name: 'By a Thread',
    expensive: true,
    findHint: findByAThreadHint,
    findResult: findByAThreadResult,
  },
  {
    id: 'by-a-thread-at-sea',
    name: 'By a Thread at Sea',
    expensive: true,
    findHint: findByAThreadAtSeaHint,
    findResult: findByAThreadAtSeaResult,
  },
];

function wrapOldTechniqueResult(hint: Hint | null): TechniqueResult {
  return hint ? { type: 'hint', hint } : { type: 'none' };
}

/** Single requestAnimationFrame yield — lets the browser paint one frame. */
function yieldFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

export async function findNextHint(state: PuzzleState): Promise<Hint | null> {
  const startTime = performance.now();
  const testedTechniques: Array<{ technique: string; timeMs: number }> = [];
  let accumulatedDeductions: Deduction[] = [];
  const signal = store.solveAbortController?.signal ?? null;

  const MAX_TOTAL_TIME_MS = 30000;
  const MAX_TECHNIQUE_TIME_MS = 10000;

  store.isThinking = true;
  store.currentTechnique = null;
  store.filteredDeductions = [];

  // One initial yield so the UI can paint "thinking" state before we start.
  await new Promise(resolve => setTimeout(resolve, 0));

  // Build shared cache once — avoids O(n²) board scan per technique.
  const _cache = buildPuzzleCache(state);

  // When a place-cross hint is found first, we store it and keep scanning for a
  // place-star hint. Star placements always take precedence because they are more
  // informative (the cross is often just a consequence of a nearby forced star).
  let firstCrossHint: { hint: Hint; techName: string; techTimeMs: number; deductions: Deduction[] } | null = null;

  function logAndReturn(hint: Hint, techName: string, techTimeMs: number, deductionList: Deduction[]): Hint {
    store.filteredDeductions = deductionList;
    const n = hint.resultCells.length;
    const kind = hint.kind === 'place-star' ? (n !== 1 ? 'stars' : 'star') : (n !== 1 ? 'crosses' : 'cross');
    addLogEntry({
      timestamp: Date.now(),
      technique: techName,
      timeMs: techTimeMs,
      message: `${hint.explanation || `Found hint via ${techName}`} (${n} ${kind})`,
      testedTechniques,
    });
    return hint;
  }

  try {
    for (const tech of techniquesInOrder) {
      if (signal?.aborted) return null;

      const elapsedTotal = performance.now() - startTime;
      if (elapsedTotal > MAX_TOTAL_TIME_MS) {
        console.error(`[TIMEOUT] findNextHint exceeded ${MAX_TOTAL_TIME_MS}ms`);
        break;
      }

      if (store.disabledTechniques.includes(tech.id)) continue;

      // If we already have a cross hint and are about to run an expensive
      // technique, stop — we've scanned all cheap techniques for a star and
      // found none. Return the cross rather than spending seconds on costly
      // techniques that are unlikely to produce a simpler star deduction.
      if (firstCrossHint !== null && tech.expensive) break;

      store.currentTechnique = tech.name;

      // Yield one animation frame before expensive techniques so the UI can
      // paint the technique name and stay responsive. Fast techniques (the
      // basics) skip this to avoid ~32 ms of unnecessary frame-wait per step.
      if (tech.expensive) {
        await yieldFrame();
        if (signal?.aborted) return null;
      }

      const techStartTime = performance.now();
      let result: TechniqueResult;

      try {
        if (tech.findResult) {
          const r = tech.findResult(state);
          result = r instanceof Promise ? await r : r;
        } else {
          const h = tech.findHint(state);
          result = wrapOldTechniqueResult(h instanceof Promise ? await h : h);
        }

        if (signal?.aborted) return null;

        const duration = performance.now() - techStartTime;
        if (duration > MAX_TECHNIQUE_TIME_MS) {
          console.error(`[TIMEOUT] ${tech.name} took ${duration.toFixed(0)}ms`);
          result = { type: 'none' };
        }
      } catch (err) {
        console.error(`[ERROR] ${tech.name} failed:`, err);
        result = { type: 'none' };
      }

      const techTimeMs = performance.now() - techStartTime;
      testedTechniques.push({ technique: tech.name, timeMs: techTimeMs });

      if (techTimeMs > 200) {
        console.warn(`[PERF] ${tech.name} took ${techTimeMs.toFixed(0)}ms`);
      }

      if (result.type === 'hint') {
        const deductionList = result.deductions ?? [];
        if (result.hint.kind === 'place-star') {
          // Star placements take priority — return immediately.
          return logAndReturn(result.hint, tech.name, techTimeMs, deductionList);
        }
        // place-cross: save it if it's the first, then keep scanning for a star.
        if (firstCrossHint === null) {
          firstCrossHint = { hint: result.hint, techName: tech.name, techTimeMs, deductions: deductionList };
        }
        continue;
      }

      if (result.type === 'deductions') {
        accumulatedDeductions = mergeDeductions(accumulatedDeductions, result.deductions);

        const analysis = analyzeDeductionsWithContext(accumulatedDeductions, state);
        store.filteredDeductions = analysis.hint ? analysis.supportingDeductions : analysis.validDeductions;

        if (analysis.hint) {
          const deductionList = analysis.supportingDeductions;
          if (analysis.hint.kind === 'place-star') {
            return logAndReturn(analysis.hint, tech.name, techTimeMs, deductionList);
          }
          if (firstCrossHint === null) {
            firstCrossHint = { hint: analysis.hint, techName: tech.name, techTimeMs, deductions: deductionList };
          }
        }
      }
    }

    // No star hint found — return the earliest cross hint if one was collected.
    if (firstCrossHint !== null) {
      return logAndReturn(firstCrossHint.hint, firstCrossHint.techName, firstCrossHint.techTimeMs, firstCrossHint.deductions);
    }

    const totalTimeMs = performance.now() - startTime;
    store.filteredDeductions = filterValidDeductions(accumulatedDeductions, state);
    addLogEntry({
      timestamp: Date.now(),
      technique: 'None',
      timeMs: totalTimeMs,
      message: 'No hint found',
      testedTechniques,
    });

    return null;
  } finally {
    store.isThinking = false;
    store.currentTechnique = null;
  }
}

export const techniqueNameById: Record<TechniqueId, string> = techniquesInOrder.reduce(
  (acc, tech) => {
    acc[tech.id] = tech.name;
    return acc;
  },
  {} as Record<TechniqueId, string>,
);
