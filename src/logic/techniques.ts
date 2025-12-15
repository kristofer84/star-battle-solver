import type { PuzzleState } from '../types/puzzle';
import type { Hint, TechniqueId } from '../types/hints';
import type { TechniqueResult, Deduction } from '../types/deductions';
import { addLogEntry, store } from '../store/puzzleStore';
import { analyzeDeductionsWithContext } from './mainSolver';
import { filterValidDeductions, mergeDeductions } from './deductionUtils';
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
import { findForcedPlacementHint, findForcedPlacementResult } from './techniques/forcedPlacement';
import { findSimpleShapesHint, findSimpleShapesResult } from './techniques/simpleShapes';
import { findUndercountingHint, findUndercountingResult } from './techniques/undercounting';
import { findOvercountingHint, findOvercountingResult } from './techniques/overcounting';
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

export interface Technique {
  id: TechniqueId;
  name: string;
  findHint(state: PuzzleState): Hint | null | Promise<Hint | null>; // Can be async
  findResult?(state: PuzzleState): TechniqueResult | Promise<TechniqueResult>; // Optional: new deduction-aware method (can be async)
}

export const techniquesInOrder: Technique[] = [
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
  {
    id: 'cross-empty-patterns',
    name: 'Cross-Empty Patterns',
    findHint: findCrossEmptyPatternsHint,
    findResult: findCrossEmptyPatternsResult,
  },
  {
    id: 'entanglement',
    name: 'Entanglement',
    findHint: findEntanglementHint,
    findResult: findEntanglementResult,
  },
  {
    id: 'cross-pressure',
    name: 'Cross Pressure',
    findHint: findCrossPressureHint,
    findResult: findCrossPressureResult,
  },
  {
    id: 'shared-row-column',
    name: 'Shared Row/Column',
    findHint: findSharedRowColumnHint,
    findResult: findSharedRowColumnResult,
  },
  {
    id: 'forced-placement',
    name: 'Forced Placement',
    findHint: findForcedPlacementHint,
    findResult: findForcedPlacementResult,
  },
  {
    id: 'undercounting',
    name: 'Undercounting',
    findHint: findUndercountingHint,
    findResult: findUndercountingResult,
  },
  {
    id: 'overcounting',
    name: 'Overcounting',
    findHint: findOvercountingHint,
    findResult: findOvercountingResult,
  },
  {
    id: 'exclusion',
    name: 'Exclusion',
    findHint: findExclusionHint,
    findResult: findExclusionResult,
  },
  {
    id: 'pressured-exclusion',
    name: 'Pressured Exclusion',
    findHint: findPressuredExclusionHint,
    findResult: findPressuredExclusionResult,
  },
  {
    id: 'adjacent-exclusion',
    name: 'Adjacent Exclusion',
    findHint: findAdjacentExclusionHint,
    findResult: findAdjacentExclusionResult,
  },
  {
    id: 'finned-counts',
    name: 'Finned Counts',
    findHint: findFinnedCountsHint,
    findResult: findFinnedCountsResult,
  },
  {
    id: 'composite-shapes',
    name: 'Composite Shapes',
    findHint: findCompositeShapesHint,
    findResult: findCompositeShapesResult,
  },
  {
    id: 'squeeze',
    name: 'Squeeze',
    findHint: findSqueezeHint,
    findResult: findSqueezeResult,
  },
  {
    id: 'set-differentials',
    name: 'Set Differentials',
    findHint: findSetDifferentialsHint,
    findResult: findSetDifferentialsResult,
  },
  {
    id: 'at-sea',
    name: 'At Sea',
    findHint: findAtSeaHint,
    findResult: findAtSeaResult,
  },
  {
    id: 'kissing-ls',
    name: 'Kissing Ls',
    findHint: findKissingLsHint,
    findResult: findKissingLsResult,
  },
  {
    id: 'the-m',
    name: 'The M',
    findHint: findTheMHint,
    findResult: findTheMResult,
  },
  {
    id: 'pressured-ts',
    name: 'Pressured Ts',
    findHint: findPressuredTsHint,
    findResult: findPressuredTsResult,
  },
  {
    id: 'schema-based',
    name: 'Schema-Based Logic',
    findHint: findSchemaBasedHint,
    findResult: findSchemaBasedResult,
  },
  {
    id: 'entanglement-patterns',
    name: 'Entanglement Patterns',
    findHint: findEntanglementPatternHint,
    findResult: findEntanglementPatternResult,
  },
  {
    id: 'fish',
    name: 'Fish',
    findHint: findFishHint,
    findResult: findFishResult,
  },
  {
    id: 'n-rooks',
    name: 'N Rooks',
    findHint: findNRooksHint,
    findResult: findNRooksResult,
  },
  {
    id: 'square-counting',
    name: 'Square Counting',
    findHint: findSquareCountingHint,
    findResult: findSquareCountingResult,
  },
  {
    id: 'by-a-thread',
    name: 'By a Thread',
    findHint: findByAThreadHint,
    findResult: findByAThreadResult,
  },
  {
    id: 'by-a-thread-at-sea',
    name: 'By a Thread at Sea',
    findHint: findByAThreadAtSeaHint,
    findResult: findByAThreadAtSeaResult,
  },
];

/**
 * Convert old-style Hint | null to TechniqueResult
 */
function wrapOldTechniqueResult(
  hint: Hint | null,
  techniqueId: TechniqueId
): TechniqueResult {
  if (hint) {
    return { type: 'hint', hint };
  }
  return { type: 'none' };
}

export async function findNextHint(state: PuzzleState): Promise<Hint | null> {
  const startTime = performance.now();
  const testedTechniques: Array<{ technique: string; timeMs: number }> = [];
  let accumulatedDeductions: Deduction[] = [];
  const signal = store.solveAbortController?.signal ?? null;
  
  // Maximum total time allowed for finding a hint (30 seconds)
  const MAX_TOTAL_TIME_MS = 30000;
  // Maximum time allowed per technique (10 seconds)
  const MAX_TECHNIQUE_TIME_MS = 10000;

  // Set thinking state
  store.isThinking = true;
  store.currentTechnique = null;
  store.filteredDeductions = [];

  // Yield to allow UI to update
  await new Promise(resolve => setTimeout(resolve, 0));

  try {
    if (signal?.aborted) {
      return null;
    }
    for (const tech of techniquesInOrder) {
      if (signal?.aborted) {
        return null;
      }
      // Check if we've exceeded total time limit
      const elapsedTotal = performance.now() - startTime;
      if (elapsedTotal > MAX_TOTAL_TIME_MS) {
        console.error(`[TIMEOUT] findNextHint exceeded maximum time limit of ${MAX_TOTAL_TIME_MS}ms`);
        return null;
      }
      
      if (store.disabledTechniques.includes(tech.id)) {
        continue;
      }

      const techStartTime = performance.now();
      store.currentTechnique = tech.name;

      // Yield to allow Vue to update the UI with the current technique name
      // Use requestAnimationFrame to ensure the browser paints before we start the technique
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          // Double RAF to ensure paint happens
          requestAnimationFrame(resolve);
        });
      });
      if (signal?.aborted) {
        return null;
      }

      // Log start of technique
      console.log(`[DEBUG] Starting ${tech.name}...`);

      // Try new findResult method first, fall back to old findHint
      let result: TechniqueResult;
      try {
        // Check time before running technique
        const beforeTech = performance.now();
        
        if (tech.findResult) {
          const resultOrPromise = tech.findResult(state);
          // Handle both sync and async results
          result = resultOrPromise instanceof Promise ? await resultOrPromise : resultOrPromise;
        } else {
          const hintOrPromise = tech.findHint(state);
          // Handle both sync and async hints
          const hint = hintOrPromise instanceof Promise ? await hintOrPromise : hintOrPromise;
          result = wrapOldTechniqueResult(hint, tech.id);
        }

        if (signal?.aborted) {
          return null;
        }
        
        // Check if technique took too long
        const afterTech = performance.now();
        const techniqueDuration = afterTech - beforeTech;
        console.error(`[DEBUG] ${tech.name} took ${techniqueDuration.toFixed(2)}ms`);

        if (techniqueDuration > MAX_TECHNIQUE_TIME_MS) {
          console.error(`[TIMEOUT] ${tech.name} took ${techniqueDuration.toFixed(2)}ms, exceeding limit of ${MAX_TECHNIQUE_TIME_MS}ms`);
          // Continue to next technique instead of returning null
          result = { type: 'none' };
        }
      } catch (error) {
        console.error(`[ERROR] ${tech.name} failed:`, error);
        result = { type: 'none' };
      }

      const techEndTime = performance.now();
      const techTimeMs = techEndTime - techStartTime;
      const techniqueName = tech.name;

      console.log(`[DEBUG] ${techniqueName} completed in ${techTimeMs.toFixed(2)}ms`);

      testedTechniques.push({
        technique: techniqueName,
        timeMs: techTimeMs,
      });

      // Warn about slow techniques
      if (techTimeMs > 100) {
        console.warn(`[PERF] ${techniqueName} took ${techTimeMs.toFixed(2)}ms`);
      }

      // Warn if technique is taking suspiciously long (potential freeze)
      if (techTimeMs > 5000) {
        console.error(`[FREEZE] ${techniqueName} took ${techTimeMs.toFixed(2)}ms - possible freeze!`);
      }

      // Handle result
      if (result.type === 'hint') {
        store.filteredDeductions = [];
        const totalTimeMs = techEndTime - startTime;
        const message = result.hint.explanation || `Found hint using ${techniqueName}`;

        console.log(`[DEBUG] ${techniqueName} found hint in ${techTimeMs.toFixed(2)}ms`);

        addLogEntry({
          timestamp: Date.now(),
          technique: techniqueName,
          timeMs: techTimeMs,
          message: `${message} (placed ${result.hint.resultCells.length} ${result.hint.kind === 'place-star' ? 'star' : 'cross'}${result.hint.resultCells.length !== 1 ? (result.hint.kind === 'place-star' ? 's' : 'es') : ''})`,
          testedTechniques: testedTechniques,
        });

        return result.hint;
      } else if (result.type === 'deductions') {
        // Add deductions to accumulator
        accumulatedDeductions = mergeDeductions(accumulatedDeductions, result.deductions);
        console.log(`[DEBUG] ${techniqueName} produced ${result.deductions.length} deduction(s), total: ${accumulatedDeductions.length}`);

        // After adding deductions, check if main solver can find a hint
        const analysis = analyzeDeductionsWithContext(accumulatedDeductions, state);
        store.filteredDeductions = analysis.validDeductions;
        if (analysis.hint) {
          const totalTimeMs = techEndTime - startTime;
          const message = analysis.hint.explanation || `Found hint by combining deductions from multiple techniques`;

          console.log(`[DEBUG] Main solver found hint after ${techniqueName} in ${techTimeMs.toFixed(2)}ms`);

          addLogEntry({
            timestamp: Date.now(),
            technique: 'Main Solver',
            timeMs: techTimeMs,
            message: `${message} (placed ${analysis.hint.resultCells.length} ${analysis.hint.kind === 'place-star' ? 'star' : 'cross'}${analysis.hint.resultCells.length !== 1 ? (analysis.hint.kind === 'place-star' ? 's' : 'es') : ''})`,
            testedTechniques: testedTechniques,
          });

          return analysis.hint;
        }
      }
      // result.type === 'none' - continue to next technique
    }

    const totalTimeMs = performance.now() - startTime;
    console.log(`[DEBUG] No hint found after ${totalTimeMs.toFixed(2)}ms (accumulated ${accumulatedDeductions.length} deductions)`);

    const filteredDeductions = filterValidDeductions(accumulatedDeductions, state);
    store.filteredDeductions = filteredDeductions;

    addLogEntry({
      timestamp: Date.now(),
      technique: 'None',
      timeMs: totalTimeMs,
      message: 'No hint found with current techniques',
      testedTechniques: testedTechniques,
    });

    return null;
  } finally {
    // Always clear thinking state
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


