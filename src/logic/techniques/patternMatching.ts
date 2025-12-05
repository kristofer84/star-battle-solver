import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { loadEntanglementSpecs, filterSpecsByPuzzle, getTripleRuleId } from '../entanglements/loader';
import { getAllPlacedStars, applyTripleRule } from '../entanglements/matcher';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `pattern-matching-${hintCounter}`;
}

/**
 * Pattern Matching technique:
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
  console.log(`[PATTERN MATCHING DEBUG] Eagerly loading entanglement specs at startup...`);
  cachedSpecs = loadEntanglementSpecs();
  console.log(`[PATTERN MATCHING DEBUG] Eager loading completed: ${cachedSpecs.length} specs cached`);
} catch (error) {
  console.warn(`[PATTERN MATCHING DEBUG] Failed to eagerly load entanglement specs:`, error);
}

let specsLoadPromise: Promise<void> | null = null;

async function ensureSpecsLoaded(): Promise<void> {
  // Specs should already be loaded eagerly, but keep this for backward compatibility
  if (cachedSpecs !== null) {
    console.log(`[PATTERN MATCHING DEBUG] Specs already loaded (${cachedSpecs.length} specs)`);
    return;
  }
  // Fallback: if somehow specs weren't loaded, load them now
  console.log(`[PATTERN MATCHING DEBUG] Specs not cached, loading now...`);
  try {
    cachedSpecs = loadEntanglementSpecs();
    console.log(`[PATTERN MATCHING DEBUG] Spec loading completed (${cachedSpecs.length} specs)`);
  } catch (error) {
    console.warn(`[PATTERN MATCHING DEBUG] Failed to load entanglement specs:`, error);
  }
}

export function findPatternMatchingHint(state: PuzzleState): Hint | null {
  const startTime = performance.now();
  const { size, starsPerUnit } = state.def;

  console.log(`[PATTERN MATCHING DEBUG] Starting pattern matching technique (board: ${size}x${size}, stars per unit: ${starsPerUnit})`);

  // Check if specs are already loaded
  if (cachedSpecs !== null) {
    console.log(`[PATTERN MATCHING DEBUG] Using cached specs (${cachedSpecs.length} specs loaded)`);
    const patternStartTime = performance.now();
    const patternHint = findPatternBasedHint(state, cachedSpecs);
    const patternTime = performance.now() - patternStartTime;
    
    if (patternHint) {
      const totalTime = performance.now() - startTime;
      console.log(`[PATTERN MATCHING DEBUG] Pattern-based hint found in ${patternTime.toFixed(2)}ms (total: ${totalTime.toFixed(2)}ms)`);
      console.log(`[PATTERN MATCHING DEBUG] Found ${patternHint.resultCells.length} forced cell(s):`, patternHint.resultCells);
      return patternHint;
    } else {
      console.log(`[PATTERN MATCHING DEBUG] No pattern-based hint found (checked in ${patternTime.toFixed(2)}ms)`);
    }
  } else {
    console.log(`[PATTERN MATCHING DEBUG] Specs not yet loaded, attempting async load...`);
    // Try to load specs asynchronously (non-blocking)
    ensureSpecsLoaded().catch((err) => {
      console.warn('[PATTERN MATCHING DEBUG] Failed to load entanglement specs:', err);
    });
  }

  const totalTime = performance.now() - startTime;
  console.log(`[PATTERN MATCHING DEBUG] Pattern matching complete (took ${totalTime.toFixed(2)}ms)`);
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

  console.log(`[PATTERN MATCHING DEBUG] Pattern-based search: ${actualStars.length} placed star(s) on board`);

  // Filter specs to match current puzzle
  const matchingSpecs = filterSpecsByPuzzle(specs, size, starsPerUnit);
  console.log(`[PATTERN MATCHING DEBUG] Found ${matchingSpecs.length} matching spec(s) for ${size}x${size} board with ${starsPerUnit} stars per unit`);

  // Try triple rules first (more specific)
  let specsChecked = 0;
  let unconstrainedRulesChecked = 0;
  let constrainedRulesChecked = 0;
  
  for (const spec of matchingSpecs) {
    specsChecked += 1;
    if (!spec.hasTriplePatterns || !spec.tripleData) {
      console.log(`[PATTERN MATCHING DEBUG] Spec ${specsChecked} (${spec.id}): skipping (no triple patterns)`);
      continue;
    }

    console.log(`[PATTERN MATCHING DEBUG] Spec ${specsChecked} (${spec.id}): ${spec.tripleData.unconstrained_rules.length} unconstrained rules, ${spec.tripleData.constrained_rules.length} constrained rules`);

    // Try unconstrained rules first
    for (const rule of spec.tripleData.unconstrained_rules) {
      unconstrainedRulesChecked += 1;
      const ruleStartTime = performance.now();
      const forcedCells = applyTripleRule(rule, state, actualStars);
      const ruleTime = performance.now() - ruleStartTime;
      
      if (forcedCells.length > 0) {
        const patternId = getTripleRuleId(rule);
        console.log(`[PATTERN MATCHING DEBUG] Unconstrained rule ${unconstrainedRulesChecked} matched! Found ${forcedCells.length} forced cell(s) in ${ruleTime.toFixed(2)}ms`);
        console.log(`[PATTERN MATCHING DEBUG] Rule: ${rule.canonical_stars.length} canonical stars, candidate at [${rule.canonical_candidate[0]},${rule.canonical_candidate[1]}], occurrences: ${rule.occurrences}, pattern ID: ${patternId}`);
        return {
          id: nextHintId(),
          kind: 'place-cross', // Triple rules typically force empty cells
          technique: 'pattern-matching',
          resultCells: forcedCells,
          explanation: `Pattern matching [${patternId}]: Based on the geometry of ${rule.canonical_stars.length} placed stars, this cell is forced to be empty. (Pattern occurred ${rule.occurrences} times in analysis.)`,
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
        console.log(`[PATTERN MATCHING DEBUG] Unconstrained rule ${unconstrainedRulesChecked} took ${ruleTime.toFixed(2)}ms (no match)`);
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
        console.log(`[PATTERN MATCHING DEBUG] Constrained rule ${constrainedRulesChecked} matched! Found ${forcedCells.length} forced cell(s) in ${ruleTime.toFixed(2)}ms`);
        console.log(`[PATTERN MATCHING DEBUG] Rule: ${rule.canonical_stars.length} canonical stars, candidate at [${rule.canonical_candidate[0]},${rule.canonical_candidate[1]}], constraints: [${constraints}], occurrences: ${rule.occurrences}, pattern ID: ${patternId}`);
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'pattern-matching',
          resultCells: forcedCells,
          explanation: `Pattern matching [${patternId}]: Based on the geometry of ${rule.canonical_stars.length} placed stars and constraints (${constraints}), this cell is forced to be empty. (Pattern occurred ${rule.occurrences} times in analysis.)`,
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
        console.log(`[PATTERN MATCHING DEBUG] Constrained rule ${constrainedRulesChecked} took ${ruleTime.toFixed(2)}ms (no match)`);
      }
    }
  }

  console.log(`[PATTERN MATCHING DEBUG] Pattern-based search complete: checked ${specsChecked} specs, ${unconstrainedRulesChecked} unconstrained rules, ${constrainedRulesChecked} constrained rules`);
  return null;
}

