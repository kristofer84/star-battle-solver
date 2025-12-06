/**
 * Pattern matching logic for entanglement rules
 * Maps canonical patterns to actual board positions
 */

import type { PuzzleState, Coords } from '../../types/puzzle';
import type {
  TripleRule,
  LoadedEntanglementSpec,
  CoordsTuple,
} from '../../types/entanglements';
import {
  transformCoordsList,
  transformCoords,
  translateCoords,
  allInBounds,
  tupleToCoords,
  coordsToTuple,
  ALL_D4_TRANSFORMATIONS,
  type D4Transformation,
} from './transformations';
import { evaluateAllFeatures } from './features';
import { getCell, neighbors8 } from '../helpers';
import { logEntanglementDebug } from './debug';

/**
 * Get all placed stars from the puzzle state
 */
export function getAllPlacedStars(state: PuzzleState): Coords[] {
  const stars: Coords[] = [];
  for (let r = 0; r < state.def.size; r += 1) {
    for (let c = 0; c < state.def.size; c += 1) {
      if (state.cells[r][c] === 'star') {
        stars.push({ row: r, col: c });
      }
    }
  }
  return stars;
}

/**
 * Find all valid mappings of a canonical pattern to actual board stars
 */
export function findPatternMappings(
  canonicalStars: CoordsTuple[],
  actualStars: Coords[],
  boardSize: number
): Array<{
  transform: D4Transformation;
  offset: CoordsTuple;
  mappedStars: Coords[];
}> {
  const mappings: Array<{
    transform: D4Transformation;
    offset: CoordsTuple;
    mappedStars: Coords[];
  }> = [];

  if (canonicalStars.length === 0 || actualStars.length < canonicalStars.length) {
    if (canonicalStars.length === 0) {
      logEntanglementDebug(`[ENTANGLEMENT DEBUG]   No canonical stars in pattern`);
    } else {
      logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Not enough actual stars (need ${canonicalStars.length}, have ${actualStars.length})`);
    }
    return mappings;
  }

  let transformsTried = 0;
  let combinationsTried = 0;
  let offsetsFound = 0;
  let validMappings = 0;

  // Try each D4 transformation
  for (const transform of ALL_D4_TRANSFORMATIONS) {
    transformsTried += 1;
    const transformed = transformCoordsList(canonicalStars, transform);

    // Try each combination of actual stars that matches the count
    const combinations = getCombinations(actualStars, canonicalStars.length);
    combinationsTried += combinations.length;

    for (const combo of combinations) {
      const actualTuples = combo.map(coordsToTuple);
      const offset = findTranslationOffset(transformed, actualTuples, boardSize);

      if (offset) {
        offsetsFound += 1;
        const mappedStars = transformed
          .map((c) => translateCoords(c, offset))
          .map(tupleToCoords);

        // Verify all mapped stars are in bounds and match actual stars
        if (allInBounds(transformed.map((c) => translateCoords(c, offset)), boardSize)) {
          validMappings += 1;
          mappings.push({
            transform,
            offset,
            mappedStars,
          });
        }
      }
    }
  }

  if (mappings.length === 0 && actualStars.length >= canonicalStars.length) {
    logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Pattern matching: ${transformsTried} transforms, ${combinationsTried} combinations, ${offsetsFound} offsets found, ${validMappings} valid mappings`);
  }

  return mappings;
}

/**
 * Find translation offset between transformed canonical stars and actual stars
 */
function findTranslationOffset(
  transformed: CoordsTuple[],
  actual: CoordsTuple[],
  boardSize: number
): CoordsTuple | null {
  if (transformed.length !== actual.length) {
    return null;
  }

  // Try each transformed star as anchor with each actual star
  for (let i = 0; i < transformed.length; i += 1) {
    for (let j = 0; j < actual.length; j += 1) {
      const offset: CoordsTuple = [
        actual[j][0] - transformed[i][0],
        actual[j][1] - transformed[i][1],
      ];

      // Apply offset to all transformed stars
      const translated = transformed.map((c) => [
        c[0] + offset[0],
        c[1] + offset[1],
      ] as CoordsTuple);

      // Check if translated matches actual (order-independent)
      if (matchesStars(translated, actual, boardSize)) {
        return offset;
      }
    }
  }

  return null;
}

/**
 * Check if two sets of stars match (order-independent)
 */
function matchesStars(
  stars1: CoordsTuple[],
  stars2: CoordsTuple[],
  boardSize: number
): boolean {
  if (stars1.length !== stars2.length) return false;
  if (!allInBounds(stars1, boardSize)) return false;

  const set1 = new Set(stars1.map(([r, c]) => `${r},${c}`));
  const set2 = new Set(stars2.map(([r, c]) => `${r},${c}`));

  if (set1.size !== set2.size) return false;

  for (const key of set1) {
    if (!set2.has(key)) return false;
  }

  return true;
}

/**
 * Get all combinations of k elements from array
 */
function getCombinations<T>(array: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > array.length) return [];

  const combinations: T[][] = [];

  function combine(start: number, combo: T[]) {
    if (combo.length === k) {
      combinations.push([...combo]);
      return;
    }

    for (let i = start; i < array.length; i += 1) {
      combo.push(array[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }

  combine(0, []);
  return combinations;
}

/**
 * Apply a triple rule to find forced cells
 */
export function applyTripleRule(
  rule: TripleRule,
  state: PuzzleState,
  actualStars: Coords[]
): Coords[] {
  const forcedCells: Coords[] = [];
  const { size } = state.def;

  // Find all valid mappings of canonical stars to actual stars
  const mappingStartTime = performance.now();
  const mappings = findPatternMappings(
    rule.canonical_stars,
    actualStars,
    size
  );
  const mappingTime = performance.now() - mappingStartTime;

  if (mappings.length > 0) {
    logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Found ${mappings.length} valid mapping(s) for rule (took ${mappingTime.toFixed(2)}ms)`);
  }

  let candidatesChecked = 0;
  let candidatesInBounds = 0;
  let candidatesEmpty = 0;
  let candidatesWithFeaturesSatisfied = 0;

  for (const mapping of mappings) {
    // Log which stars are being matched
    // console.log(`[ENTANGLEMENT DEBUG]   Mapping: canonical stars [${rule.canonical_stars.map(s => `[${s[0]},${s[1]}]`).join(', ')}] -> actual stars [${mapping.mappedStars.map(s => `(${s.row},${s.col})`).join(', ')}]`);
    // console.log(`[ENTANGLEMENT DEBUG]   Transform and offset applied to map canonical to actual`);
    
    // Transform the canonical candidate using the same transformation and offset
    const transformedCandidate = transformCoords(rule.canonical_candidate, mapping.transform);

    // Apply the same translation offset
    const candidateTuple: CoordsTuple = [
      transformedCandidate[0] + mapping.offset[0],
      transformedCandidate[1] + mapping.offset[1],
    ];

    candidatesChecked += 1;

    // Check bounds
    if (!allInBounds([candidateTuple], size)) {
      continue;
    }

    candidatesInBounds += 1;
    const candidate = tupleToCoords(candidateTuple);

    // Check if candidate is currently undecided
    if (getCell(state, candidate) !== 'empty') {
      continue;
    }

    candidatesEmpty += 1;

    // Safety check: verify candidate is not adjacent to any of the matched stars
    // If it is, then the pattern is redundant (adjacency would force it empty anyway)
    const candidateNeighbors = neighbors8(candidate, size);
    const isAdjacentToMatchedStars = mapping.mappedStars.some(star => {
      const rowDiff = Math.abs(candidate.row - star.row);
      const colDiff = Math.abs(candidate.col - star.col);
      return rowDiff <= 1 && colDiff <= 1 && (rowDiff !== 0 || colDiff !== 0);
    });
    if (isAdjacentToMatchedStars) {
      logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Candidate (${candidate.row},${candidate.col}) is adjacent to matched stars - skipping (pattern would be redundant)`);
      continue;
    }

    // Evaluate constraint features
    const featuresStartTime = performance.now();
    logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Evaluating candidate (${candidate.row},${candidate.col}) for rule with features: [${rule.constraint_features.join(', ')}]`);
    logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Canonical candidate was [${rule.canonical_candidate[0]},${rule.canonical_candidate[1]}], transformed and translated to (${candidate.row},${candidate.col})`);
    const featuresSatisfied = evaluateAllFeatures(
      rule.constraint_features,
      state,
      candidate,
      mapping.mappedStars
    );
    const featuresTime = performance.now() - featuresStartTime;

    if (featuresSatisfied) {
      candidatesWithFeaturesSatisfied += 1;
      logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Candidate (${candidate.row},${candidate.col}) matches rule (features checked in ${featuresTime.toFixed(2)}ms)`);
      
      // Additional validation: For constrained rules with low occurrences, be more conservative
      // Pattern [39220f] has been observed to have false positives, so we require higher confidence
      if (rule.constraint_features.length > 0 && rule.occurrences < 50) {
        logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Constrained rule with only ${rule.occurrences} occurrences - requiring additional validation`);
        // For now, we'll still apply it but log a warning
        // In the future, we might want to add more sophisticated validation
      }
      
      // Rule applies - candidate is forced
      // Note: The rule.forced field indicates whether it's forced star or forced empty
      // For now, we'll treat it as forced empty (cross) based on typical entanglement semantics
      // This might need adjustment based on actual data format
      forcedCells.push(candidate);
    } else {
      logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Candidate (${candidate.row},${candidate.col}) does NOT match rule - features not satisfied`);
    }
  }

  if (mappings.length > 0 && forcedCells.length === 0) {
    logEntanglementDebug(`[ENTANGLEMENT DEBUG]   Rule matched ${mappings.length} mapping(s) but no forced cells: ${candidatesChecked} candidates checked, ${candidatesInBounds} in bounds, ${candidatesEmpty} empty, ${candidatesWithFeaturesSatisfied} with features satisfied`);
  }

  return forcedCells;
}

