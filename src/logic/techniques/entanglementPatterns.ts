import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult } from '../../types/deductions';
import { loadEntanglementSpecs, filterSpecsByPuzzle, getTripleRuleId } from '../entanglements/loader';
import { getAllPlacedStars, applyTripleRule } from '../entanglements/matcher';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `entanglement-patterns-${hintCounter}`;
}

/**
 * Entanglement Patterns technique:
 *
 * Uses pre-computed entanglement patterns from JSON files to identify forced cells.
 * These patterns are based on geometric relationships between placed stars and
 * can detect complex constraint interactions that would be difficult to find heuristically.
 */

// Cache for loaded specs (eagerly loaded at module initialization)
let cachedSpecs: ReturnType<typeof loadEntanglementSpecs> | null = null;

// Eagerly load specs synchronously at module initialization
// Since JSON files are already imported, we can load them immediately
try {
  console.log(`[ENTANGLEMENT PATTERNS DEBUG] Eagerly loading entanglement specs at startup...`);
  cachedSpecs = loadEntanglementSpecs();
  console.log(`[ENTANGLEMENT PATTERNS DEBUG] Eager loading completed: ${cachedSpecs.length} specs cached`);
} catch (error) {
  console.warn(`[ENTANGLEMENT PATTERNS DEBUG] Failed to eagerly load entanglement specs:`, error);
}

let specsLoadPromise: Promise<void> | null = null;

async function ensureSpecsLoaded(): Promise<void> {
  // Specs should already be loaded eagerly, but keep this for backward compatibility
  if (cachedSpecs !== null) {
    console.log(`[ENTANGLEMENT PATTERNS DEBUG] Specs already loaded (${cachedSpecs.length} specs)`);
    return;
  }
  // Fallback: if somehow specs weren't loaded, load them now
  console.log(`[ENTANGLEMENT PATTERNS DEBUG] Specs not cached, loading now...`);
  try {
    cachedSpecs = loadEntanglementSpecs();
    console.log(`[ENTANGLEMENT PATTERNS DEBUG] Spec loading completed (${cachedSpecs.length} specs)`);
  } catch (error) {
    console.warn(`[ENTANGLEMENT PATTERNS DEBUG] Failed to load entanglement specs:`, error);
  }
}

export function findEntanglementPatternHint(state: PuzzleState): Hint | null {
  const startTime = performance.now();
  const { size, starsPerUnit } = state.def;

  console.log(`[ENTANGLEMENT PATTERNS DEBUG] Starting entanglement patterns technique (board: ${size}x${size}, stars per unit: ${starsPerUnit})`);

  // Check if specs are already loaded
  if (cachedSpecs !== null) {
    console.log(`[ENTANGLEMENT PATTERNS DEBUG] Using cached specs (${cachedSpecs.length} specs loaded)`);
    const patternStartTime = performance.now();
    const patternHint = findPatternBasedHint(state, cachedSpecs);
    const patternTime = performance.now() - patternStartTime;
    
    if (patternHint) {
      const totalTime = performance.now() - startTime;
      console.log(`[ENTANGLEMENT PATTERNS DEBUG] Pattern-based hint found in ${patternTime.toFixed(2)}ms (total: ${totalTime.toFixed(2)}ms)`);
      console.log(`[ENTANGLEMENT PATTERNS DEBUG] Found ${patternHint.resultCells.length} forced cell(s):`, patternHint.resultCells);
      return patternHint;
    } else {
      console.log(`[ENTANGLEMENT PATTERNS DEBUG] No pattern-based hint found (checked in ${patternTime.toFixed(2)}ms)`);
    }
  } else {
    console.log(`[ENTANGLEMENT PATTERNS DEBUG] Specs not yet loaded, attempting async load...`);
    // Try to load specs asynchronously (non-blocking)
    ensureSpecsLoaded().catch((err) => {
      console.warn('[ENTANGLEMENT PATTERNS DEBUG] Failed to load entanglement specs:', err);
    });
  }

  const totalTime = performance.now() - startTime;
  console.log(`[ENTANGLEMENT PATTERNS DEBUG] Entanglement patterns complete (took ${totalTime.toFixed(2)}ms)`);
  return null;
}

/**
 * Find hints using loaded entanglement patterns
 */
function findPatternBasedHint(
  state: PuzzleState,
  specs: Awaited<ReturnType<typeof loadEntanglementSpecs>>
): Hint | null {
  const { size, starsPerUnit } = state.def;
  const actualStars = getAllPlacedStars(state);

  console.log(`[ENTANGLEMENT PATTERNS DEBUG] Pattern-based search: ${actualStars.length} placed star(s) on board`);

  // Filter specs to match current puzzle
  const matchingSpecs = filterSpecsByPuzzle(specs, size, starsPerUnit);
  console.log(`[ENTANGLEMENT PATTERNS DEBUG] Found ${matchingSpecs.length} matching spec(s) for ${size}x${size} board with ${starsPerUnit} stars per unit`);

  // Try triple rules first (more specific)
  let specsChecked = 0;
  let unconstrainedRulesChecked = 0;
  let constrainedRulesChecked = 0;
  
  for (const spec of matchingSpecs) {
    specsChecked += 1;
    if (!spec.hasTriplePatterns || !spec.tripleData) {
      console.log(`[ENTANGLEMENT PATTERNS DEBUG] Spec ${specsChecked} (${spec.id}): skipping (no triple patterns)`);
      continue;
    }

    console.log(`[ENTANGLEMENT PATTERNS DEBUG] Spec ${specsChecked} (${spec.id}): ${spec.tripleData.unconstrained_rules.length} unconstrained rules, ${spec.tripleData.constrained_rules.length} constrained rules`);

    // Try unconstrained rules first
    for (const rule of spec.tripleData.unconstrained_rules) {
      unconstrainedRulesChecked += 1;
      const ruleStartTime = performance.now();
      const forcedCells = applyTripleRule(rule, state, actualStars);
      const ruleTime = performance.now() - ruleStartTime;
      
      if (forcedCells.length > 0) {
        const patternId = getTripleRuleId(rule);
        console.log(`[ENTANGLEMENT PATTERNS DEBUG] Unconstrained rule ${unconstrainedRulesChecked} matched! Found ${forcedCells.length} forced cell(s) in ${ruleTime.toFixed(2)}ms`);
        console.log(`[ENTANGLEMENT PATTERNS DEBUG] Rule: ${rule.canonical_stars.length} canonical stars, candidate at [${rule.canonical_candidate[0]},${rule.canonical_candidate[1]}], occurrences: ${rule.occurrences}, pattern ID: ${patternId}`);
        return {
          id: nextHintId(),
          kind: 'place-cross', // Triple rules typically force empty cells
          technique: 'entanglement-patterns',
          resultCells: forcedCells,
          explanation: `Entanglement pattern [${patternId}]: Based on the geometry of ${rule.canonical_stars.length} placed stars, this cell is forced to be empty. (Pattern occurred ${rule.occurrences} times in analysis.)`,
          highlights: {
            cells: [
              ...actualStars,
              ...forcedCells,
            ],
          },
          patternId,
        };
      }
      
      if (ruleTime > 10) {
        console.log(`[ENTANGLEMENT PATTERNS DEBUG] Unconstrained rule ${unconstrainedRulesChecked} took ${ruleTime.toFixed(2)}ms (no match)`);
      }
    }

    // Try constrained rules
    for (const rule of spec.tripleData.constrained_rules) {
      constrainedRulesChecked += 1;
      const ruleStartTime = performance.now();
      const forcedCells = applyTripleRule(rule, state, actualStars);
      const ruleTime = performance.now() - ruleStartTime;
      
      if (forcedCells.length > 0) {
        const patternId = getTripleRuleId(rule);
        const constraints = rule.constraint_features.join(', ');
        console.log(`[ENTANGLEMENT PATTERNS DEBUG] Constrained rule ${constrainedRulesChecked} matched! Found ${forcedCells.length} forced cell(s) in ${ruleTime.toFixed(2)}ms`);
        console.log(`[ENTANGLEMENT PATTERNS DEBUG] Rule: ${rule.canonical_stars.length} canonical stars, candidate at [${rule.canonical_candidate[0]},${rule.canonical_candidate[1]}], constraints: [${constraints}], occurrences: ${rule.occurrences}, pattern ID: ${patternId}`);
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'entanglement-patterns',
          resultCells: forcedCells,
          explanation: `Entanglement pattern [${patternId}]: Based on the geometry of ${rule.canonical_stars.length} placed stars and constraints (${constraints}), this cell is forced to be empty. (Pattern occurred ${rule.occurrences} times in analysis.)`,
          highlights: {
            cells: [
              ...actualStars,
              ...forcedCells,
            ],
          },
          patternId,
        };
      }
      
      if (ruleTime > 10) {
        console.log(`[ENTANGLEMENT PATTERNS DEBUG] Constrained rule ${constrainedRulesChecked} took ${ruleTime.toFixed(2)}ms (no match)`);
      }
    }
  }

  console.log(`[ENTANGLEMENT PATTERNS DEBUG] Pattern-based search complete: checked ${specsChecked} specs, ${unconstrainedRulesChecked} unconstrained rules, ${constrainedRulesChecked} constrained rules`);
  return null;
}

/**
 * Find result with deductions support
 */
export function findEntanglementPatternResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findEntanglementPatternHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // Entanglement patterns use pre-computed patterns to find forced cells.
  // We could emit CellDeduction for forced cells from patterns,
  // but the technique uses pattern matching and primarily produces hints directly.

  return { type: 'none' };
}

