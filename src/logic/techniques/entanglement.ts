import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import {
  getCell,
  rowCells,
  colCells,
  regionCells,
  emptyCells,
  countStars,
  neighbors8,
  formatRow,
  formatCol,
  formatRegion,
} from '../helpers';
import { loadEntanglementSpecs, filterSpecsByPuzzle, getTripleRuleId, getConstrainedRuleId } from '../entanglements/loader';
import { getAllPlacedStars, applyTripleRule } from '../entanglements/matcher';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `entanglement-${hintCounter}`;
}

/**
 * Entanglement technique:
 *
 * When multiple constraints interact in complex ways, they can force specific cells
 * even when no single constraint alone would force them. This technique looks for
 * situations where:
 * - Multiple units (rows, columns, regions) have limited placement options
 * - These units share cells, creating interdependencies
 * - The combination of constraints forces specific placements
 *
 * Example:
 * - Row 3 needs 1 more star and has only 2 possible positions: (3,4) and (3,7)
 * - Column 4 needs 1 more star and has only 2 possible positions: (3,4) and (6,4)
 * - Region 5 needs 1 more star and has only 2 possible positions: (3,7) and (6,4)
 * - These constraints entangle: if (3,4) is not a star, then (3,7) must be (row 3),
 *   which forces (6,4) to be a star (region 5), which forces (3,4) to be a star (column 4)
 * - This contradiction means (3,4) must be a star
 */
// Cache for loaded specs (eagerly loaded at module initialization)
let cachedSpecs: ReturnType<typeof loadEntanglementSpecs> | null = null;

// Eagerly load specs synchronously at module initialization
// Since JSON files are already imported, we can load them immediately
try {
  console.log(`[ENTANGLEMENT DEBUG] Eagerly loading entanglement specs at startup...`);
  cachedSpecs = loadEntanglementSpecs();
  console.log(`[ENTANGLEMENT DEBUG] Eager loading completed: ${cachedSpecs.length} specs cached`);
} catch (error) {
  console.warn(`[ENTANGLEMENT DEBUG] Failed to eagerly load entanglement specs:`, error);
}

let specsLoadPromise: Promise<void> | null = null;

async function ensureSpecsLoaded(): Promise<void> {
  // Specs should already be loaded eagerly, but keep this for backward compatibility
  if (cachedSpecs !== null) {
    console.log(`[ENTANGLEMENT DEBUG] Specs already loaded (${cachedSpecs.length} specs)`);
    return;
  }
  // Fallback: if somehow specs weren't loaded, load them now
  console.log(`[ENTANGLEMENT DEBUG] Specs not cached, loading now...`);
  try {
    cachedSpecs = loadEntanglementSpecs();
    console.log(`[ENTANGLEMENT DEBUG] Spec loading completed (${cachedSpecs.length} specs)`);
  } catch (error) {
    console.warn(`[ENTANGLEMENT DEBUG] Failed to load entanglement specs:`, error);
  }
}

export function findEntanglementHint(state: PuzzleState): Hint | null {
  const startTime = performance.now();
  const { size, starsPerUnit } = state.def;

  console.log(`[ENTANGLEMENT DEBUG] Starting entanglement technique (board: ${size}x${size}, stars per unit: ${starsPerUnit})`);

  // Try pattern-based entanglement first (if specs are available)
  // Note: This is synchronous, so we check if specs are already loaded
  if (cachedSpecs !== null) {
    console.log(`[ENTANGLEMENT DEBUG] Using cached specs (${cachedSpecs.length} specs loaded)`);
    const patternStartTime = performance.now();
    const patternHint = findPatternBasedHint(state, cachedSpecs);
    const patternTime = performance.now() - patternStartTime;
    
    if (patternHint) {
      const totalTime = performance.now() - startTime;
      console.log(`[ENTANGLEMENT DEBUG] Pattern-based hint found in ${patternTime.toFixed(2)}ms (total: ${totalTime.toFixed(2)}ms)`);
      console.log(`[ENTANGLEMENT DEBUG] Found ${patternHint.resultCells.length} forced cell(s):`, patternHint.resultCells);
      return patternHint;
    } else {
      console.log(`[ENTANGLEMENT DEBUG] No pattern-based hint found (checked in ${patternTime.toFixed(2)}ms)`);
    }
  } else {
    console.log(`[ENTANGLEMENT DEBUG] Specs not yet loaded, attempting async load...`);
    // Try to load specs asynchronously (non-blocking)
    ensureSpecsLoaded().catch((err) => {
      console.warn('[ENTANGLEMENT DEBUG] Failed to load entanglement specs:', err);
    });
  }

  // Fall back to heuristic approach
  console.log(`[ENTANGLEMENT DEBUG] Falling back to heuristic approach...`);
  const heuristicStartTime = performance.now();
  
  // Find all constrained units (units with limited placement options)
  const constrainedUnits = findConstrainedUnits(state);
  const constrainedUnitsTime = performance.now() - heuristicStartTime;
  
  console.log(`[ENTANGLEMENT DEBUG] Found ${constrainedUnits.length} constrained units (took ${constrainedUnitsTime.toFixed(2)}ms)`);
  
  if (constrainedUnits.length > 0) {
    const unitTypes = constrainedUnits.reduce((acc, u) => {
      acc[u.type] = (acc[u.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[ENTANGLEMENT DEBUG] Constrained units breakdown:`, unitTypes);
  }

  if (constrainedUnits.length < 2) {
    const totalTime = performance.now() - startTime;
    console.log(`[ENTANGLEMENT DEBUG] Not enough constrained units (need 2+, found ${constrainedUnits.length}), returning null (total: ${totalTime.toFixed(2)}ms)`);
    return null;
  }

  // Look for entangled constraints
  let pairsChecked = 0;
  let pairsWithSharedCells = 0;
  let pairsWithForcedCells = 0;
  
  for (let i = 0; i < constrainedUnits.length; i += 1) {
    for (let j = i + 1; j < constrainedUnits.length; j += 1) {
      pairsChecked += 1;
      const unit1 = constrainedUnits[i];
      const unit2 = constrainedUnits[j];

      // Check if these units share cells (potential entanglement)
      const sharedCells = findSharedCells(unit1.possibleCells, unit2.possibleCells);

      if (sharedCells.length > 0) {
        pairsWithSharedCells += 1;
        console.log(`[ENTANGLEMENT DEBUG] Pair ${pairsChecked}: ${formatUnit(unit1)} & ${formatUnit(unit2)} share ${sharedCells.length} cell(s)`);
        
        // Analyze the entanglement
        const analysisStartTime = performance.now();
        const forcedCells = analyzeEntanglement(state, [unit1, unit2], constrainedUnits);
        const analysisTime = performance.now() - analysisStartTime;
        
        if (forcedCells.length > 0) {
          pairsWithForcedCells += 1;
          console.log(`[ENTANGLEMENT DEBUG] Found ${forcedCells.length} forced cell(s) in ${analysisTime.toFixed(2)}ms:`, 
            forcedCells.map(fc => `${fc.kind === 'place-star' ? 'star' : 'cross'} at (${fc.cell.row},${fc.cell.col})`));
          
          // Filter out any forced stars that would be adjacent to other forced stars
          const validForcedCells = filterValidForcedCells(state, forcedCells);
          
          if (validForcedCells.length === 0) {
            console.log(`[ENTANGLEMENT DEBUG] All forced cells filtered out (adjacency conflicts)`);
            continue; // Skip if no valid forced cells remain
          }
          
          console.log(`[ENTANGLEMENT DEBUG] ${validForcedCells.length} valid forced cell(s) after filtering`);

          const regions = new Set<number>();
          const rows = new Set<number>();
          const cols = new Set<number>();

          for (const unit of [unit1, unit2]) {
            if (unit.type === 'region') regions.add(unit.id);
            if (unit.type === 'row') rows.add(unit.id);
            if (unit.type === 'col') cols.add(unit.id);
          }

          const unitDesc1 = formatUnit(unit1);
          const unitDesc2 = formatUnit(unit2);

          return {
            id: nextHintId(),
            kind: validForcedCells[0].kind,
            technique: 'entanglement',
            resultCells: validForcedCells.map((fc) => fc.cell),
            explanation: `Entanglement: ${unitDesc1} and ${unitDesc2} have limited placement options that interact. When these constraints are combined, specific cells are forced.`,
            highlights: {
              cells: [
                ...unit1.possibleCells,
                ...unit2.possibleCells,
                ...validForcedCells.map((fc) => fc.cell),
              ],
              rows: rows.size > 0 ? Array.from(rows) : undefined,
              cols: cols.size > 0 ? Array.from(cols) : undefined,
              regions: regions.size > 0 ? Array.from(regions) : undefined,
            },
          };
        }
      }
    }
  }

  const totalTime = performance.now() - startTime;
  console.log(`[ENTANGLEMENT DEBUG] Pair analysis complete: checked ${pairsChecked} pairs, ${pairsWithSharedCells} with shared cells, ${pairsWithForcedCells} with forced cells (took ${totalTime.toFixed(2)}ms)`);

  // Try more complex entanglements with 3+ units
  let tripletsChecked = 0;
  let tripletsWithSharedCells = 0;
  let tripletsWithForcedCells = 0;
  
  for (let i = 0; i < constrainedUnits.length; i += 1) {
    for (let j = i + 1; j < constrainedUnits.length; j += 1) {
      for (let k = j + 1; k < constrainedUnits.length; k += 1) {
        tripletsChecked += 1;
        const units = [constrainedUnits[i], constrainedUnits[j], constrainedUnits[k]];

        // Check if these units form an entangled system
        if (hasSharedCells(units)) {
          tripletsWithSharedCells += 1;
          console.log(`[ENTANGLEMENT DEBUG] Triplet ${tripletsChecked}: ${units.map(formatUnit).join(', ')} share cells`);
          
          const analysisStartTime = performance.now();
          const forcedCells = analyzeEntanglement(state, units, constrainedUnits);
          const analysisTime = performance.now() - analysisStartTime;

          if (forcedCells.length > 0) {
            tripletsWithForcedCells += 1;
            console.log(`[ENTANGLEMENT DEBUG] Found ${forcedCells.length} forced cell(s) in triplet (took ${analysisTime.toFixed(2)}ms)`);
            
            // Filter out any forced stars that would be adjacent to other forced stars
            const validForcedCells = filterValidForcedCells(state, forcedCells);
            
            if (validForcedCells.length === 0) {
              console.log(`[ENTANGLEMENT DEBUG] All triplet forced cells filtered out (adjacency conflicts)`);
              continue; // Skip if no valid forced cells remain
            }
            
            console.log(`[ENTANGLEMENT DEBUG] ${validForcedCells.length} valid forced cell(s) from triplet after filtering`);

            const regions = new Set<number>();
            const rows = new Set<number>();
            const cols = new Set<number>();

            for (const unit of units) {
              if (unit.type === 'region') regions.add(unit.id);
              if (unit.type === 'row') rows.add(unit.id);
              if (unit.type === 'col') cols.add(unit.id);
            }

            const unitDescs = units.map(formatUnit).join(', ');

            return {
              id: nextHintId(),
              kind: validForcedCells[0].kind,
              technique: 'entanglement',
              resultCells: validForcedCells.map((fc) => fc.cell),
              explanation: `Entanglement: ${unitDescs} have limited placement options that interact. When these constraints are combined, specific cells are forced.`,
              highlights: {
                cells: [
                  ...units.flatMap((u) => u.possibleCells),
                  ...validForcedCells.map((fc) => fc.cell),
                ],
                rows: rows.size > 0 ? Array.from(rows) : undefined,
                cols: cols.size > 0 ? Array.from(cols) : undefined,
                regions: regions.size > 0 ? Array.from(regions) : undefined,
              },
            };
          }
        }
      }
    }
  }

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

  console.log(`[ENTANGLEMENT DEBUG] Pattern-based search: ${actualStars.length} placed star(s) on board`);

  // Filter specs to match current puzzle
  const matchingSpecs = filterSpecsByPuzzle(specs, size, starsPerUnit);
  console.log(`[ENTANGLEMENT DEBUG] Found ${matchingSpecs.length} matching spec(s) for ${size}x${size} board with ${starsPerUnit} stars per unit`);

  // Try triple rules first (more specific)
  let specsChecked = 0;
  let unconstrainedRulesChecked = 0;
  let constrainedRulesChecked = 0;
  
  for (const spec of matchingSpecs) {
    specsChecked += 1;
    if (!spec.hasTriplePatterns || !spec.tripleData) {
      console.log(`[ENTANGLEMENT DEBUG] Spec ${specsChecked} (${spec.id}): skipping (no triple patterns)`);
      continue;
    }

    console.log(`[ENTANGLEMENT DEBUG] Spec ${specsChecked} (${spec.id}): ${spec.tripleData.unconstrained_rules.length} unconstrained rules, ${spec.tripleData.constrained_rules.length} constrained rules`);

    // Try unconstrained rules first
    for (const rule of spec.tripleData.unconstrained_rules) {
      unconstrainedRulesChecked += 1;
      const ruleStartTime = performance.now();
      const forcedCells = applyTripleRule(rule, state, actualStars);
      const ruleTime = performance.now() - ruleStartTime;
      
      if (forcedCells.length > 0) {
        const patternId = getTripleRuleId(rule);
        console.log(`[ENTANGLEMENT DEBUG] Unconstrained rule ${unconstrainedRulesChecked} matched! Found ${forcedCells.length} forced cell(s) in ${ruleTime.toFixed(2)}ms`);
        console.log(`[ENTANGLEMENT DEBUG] Rule: ${rule.canonical_stars.length} canonical stars, candidate at [${rule.canonical_candidate[0]},${rule.canonical_candidate[1]}], occurrences: ${rule.occurrences}, pattern ID: ${patternId}`);
        return {
          id: nextHintId(),
          kind: 'place-cross', // Triple rules typically force empty cells
          technique: 'entanglement',
          resultCells: forcedCells,
          explanation: `Entanglement pattern [${patternId}]: Based on the geometry of ${rule.canonical_stars.length} placed stars, this cell is forced to be empty. (Pattern occurred ${rule.occurrences} times in analysis.)`,
          highlights: {
            cells: [
              ...actualStars,
              ...forcedCells,
            ],
          },
        };
      }
      
      if (ruleTime > 10) {
        console.log(`[ENTANGLEMENT DEBUG] Unconstrained rule ${unconstrainedRulesChecked} took ${ruleTime.toFixed(2)}ms (no match)`);
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
        console.log(`[ENTANGLEMENT DEBUG] Constrained rule ${constrainedRulesChecked} matched! Found ${forcedCells.length} forced cell(s) in ${ruleTime.toFixed(2)}ms`);
        console.log(`[ENTANGLEMENT DEBUG] Rule: ${rule.canonical_stars.length} canonical stars, candidate at [${rule.canonical_candidate[0]},${rule.canonical_candidate[1]}], constraints: [${constraints}], occurrences: ${rule.occurrences}, pattern ID: ${patternId}`);
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'entanglement',
          resultCells: forcedCells,
          explanation: `Entanglement pattern [${patternId}]: Based on the geometry of ${rule.canonical_stars.length} placed stars and constraints (${constraints}), this cell is forced to be empty. (Pattern occurred ${rule.occurrences} times in analysis.)`,
          highlights: {
            cells: [
              ...actualStars,
              ...forcedCells,
            ],
          },
        };
      }
      
      if (ruleTime > 10) {
        console.log(`[ENTANGLEMENT DEBUG] Constrained rule ${constrainedRulesChecked} took ${ruleTime.toFixed(2)}ms (no match)`);
      }
    }
  }

  console.log(`[ENTANGLEMENT DEBUG] Pattern-based search complete: checked ${specsChecked} specs, ${unconstrainedRulesChecked} unconstrained rules, ${constrainedRulesChecked} constrained rules`);
  return null;
}

interface ConstrainedUnit {
  type: 'row' | 'col' | 'region';
  id: number;
  starsNeeded: number;
  possibleCells: Coords[];
}

interface ForcedCell {
  cell: Coords;
  kind: 'place-star' | 'place-cross';
}

/**
 * Find all units that have limited placement options (2-4 possible cells for remaining stars)
 */
function findConstrainedUnits(state: PuzzleState): ConstrainedUnit[] {
  const { size, starsPerUnit } = state.def;
  const constrained: ConstrainedUnit[] = [];

  // Check rows
  for (let row = 0; row < size; row += 1) {
    const cells = rowCells(state, row);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    const starsNeeded = starsPerUnit - stars;

    if (starsNeeded > 0 && empties.length >= starsNeeded && empties.length <= 4) {
      // Filter to viable cells (not blocked by constraints)
      const viableCells = empties.filter((cell) => isViableForStar(state, cell));

      if (viableCells.length >= starsNeeded && viableCells.length <= 4) {
        constrained.push({
          type: 'row',
          id: row,
          starsNeeded,
          possibleCells: viableCells,
        });
      }
    }
  }

  // Check columns
  for (let col = 0; col < size; col += 1) {
    const cells = colCells(state, col);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    const starsNeeded = starsPerUnit - stars;

    if (starsNeeded > 0 && empties.length >= starsNeeded && empties.length <= 4) {
      const viableCells = empties.filter((cell) => isViableForStar(state, cell));

      if (viableCells.length >= starsNeeded && viableCells.length <= 4) {
        constrained.push({
          type: 'col',
          id: col,
          starsNeeded,
          possibleCells: viableCells,
        });
      }
    }
  }

  // Check regions
  for (let regionId = 1; regionId <= 10; regionId += 1) {
    const cells = regionCells(state, regionId);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    const starsNeeded = starsPerUnit - stars;

    if (starsNeeded > 0 && empties.length >= starsNeeded && empties.length <= 4) {
      const viableCells = empties.filter((cell) => isViableForStar(state, cell));

      if (viableCells.length >= starsNeeded && viableCells.length <= 4) {
        constrained.push({
          type: 'region',
          id: regionId,
          starsNeeded,
          possibleCells: viableCells,
        });
      }
    }
  }

  // Debug output for constrained units
  if (constrained.length > 0) {
    console.log(`[ENTANGLEMENT DEBUG] Constrained units details:`);
    for (const unit of constrained) {
      console.log(`[ENTANGLEMENT DEBUG]   ${formatUnit(unit)}: needs ${unit.starsNeeded} star(s), ${unit.possibleCells.length} possible cell(s):`, 
        unit.possibleCells.map(c => `(${c.row},${c.col})`).join(', '));
    }
  }

  return constrained;
}

/**
 * Check if a cell is viable for placing a star (not blocked by basic constraints)
 */
function isViableForStar(state: PuzzleState, cell: Coords): boolean {
  // Check adjacency constraint
  const neighbors = neighbors8(cell, state.def.size);
  for (const neighbor of neighbors) {
    if (getCell(state, neighbor) === 'star') return false;
  }

  // Check 2×2 constraint
  for (let dr = -1; dr <= 0; dr += 1) {
    for (let dc = -1; dc <= 0; dc += 1) {
      const topLeft = { row: cell.row + dr, col: cell.col + dc };
      if (
        topLeft.row >= 0 &&
        topLeft.col >= 0 &&
        topLeft.row < state.def.size - 1 &&
        topLeft.col < state.def.size - 1
      ) {
        const block: Coords[] = [
          topLeft,
          { row: topLeft.row, col: topLeft.col + 1 },
          { row: topLeft.row + 1, col: topLeft.col },
          { row: topLeft.row + 1, col: topLeft.col + 1 },
        ];

        const starsInBlock = block.filter((c) => getCell(state, c) === 'star').length;
        if (starsInBlock >= 1) return false;
      }
    }
  }

  return true;
}

/**
 * Find cells that appear in both lists
 */
function findSharedCells(cells1: Coords[], cells2: Coords[]): Coords[] {
  const shared: Coords[] = [];

  for (const c1 of cells1) {
    for (const c2 of cells2) {
      if (c1.row === c2.row && c1.col === c2.col) {
        shared.push(c1);
        break;
      }
    }
  }

  return shared;
}

/**
 * Check if a list of units has any shared cells
 */
function hasSharedCells(units: ConstrainedUnit[]): boolean {
  for (let i = 0; i < units.length; i += 1) {
    for (let j = i + 1; j < units.length; j += 1) {
      const shared = findSharedCells(units[i].possibleCells, units[j].possibleCells);
      if (shared.length > 0) return true;
    }
  }
  return false;
}

/**
 * Analyze entangled constraints to find forced cells
 */
function analyzeEntanglement(
  state: PuzzleState,
  entangledUnits: ConstrainedUnit[],
  allConstrainedUnits: ConstrainedUnit[]
): ForcedCell[] {
  const forcedCells: ForcedCell[] = [];

  // Collect all cells involved in the entanglement
  const allCells = new Set<string>();
  for (const unit of entangledUnits) {
    for (const cell of unit.possibleCells) {
      allCells.add(`${cell.row},${cell.col}`);
    }
  }

  console.log(`[ENTANGLEMENT DEBUG]     Analyzing ${allCells.size} unique cell(s) across ${entangledUnits.length} unit(s)`);

  let cellsTestedForStar = 0;
  let cellsTestedForCross = 0;
  let contradictionsFoundForStar = 0;
  let contradictionsFoundForCross = 0;

  // For each cell in the entanglement, test if it's forced
  for (const cellKey of allCells) {
    const [row, col] = cellKey.split(',').map(Number);
    const cell = { row, col };

    // Test hypothesis: what if this cell is NOT a star?
    const testState = simulateCross(state, cell);

    // Check if this leads to a contradiction in any of the entangled units
    let contradiction = false;
    let contradictionUnit: ConstrainedUnit | null = null;

    for (const unit of entangledUnits) {
      // Count remaining viable cells for this unit
      const viableCells = unit.possibleCells.filter((c) => {
        if (c.row === cell.row && c.col === cell.col) return false;
        return isViableForStar(testState, c);
      });

      // If we don't have enough viable cells for the stars needed, contradiction
      if (viableCells.length < unit.starsNeeded) {
        contradiction = true;
        contradictionUnit = unit;
        break;
      }
    }

    if (contradiction) {
      cellsTestedForStar += 1;
      contradictionsFoundForStar += 1;
      console.log(`[ENTANGLEMENT DEBUG]     Cell (${cell.row},${cell.col}) forced to be star (contradiction in ${formatUnit(contradictionUnit!)})`);
      forcedCells.push({ cell, kind: 'place-star' });
    }
  }

  // Also check for forced crosses: cells that would create contradictions if they were stars
  const allPossibleCells = entangledUnits.flatMap((u) => u.possibleCells);
  const uniqueCells = deduplicateCells(allPossibleCells);

  for (const cell of uniqueCells) {
    // Skip if already identified as forced star
    if (forcedCells.some((fc) => fc.cell.row === cell.row && fc.cell.col === cell.col)) {
      continue;
    }

    cellsTestedForCross += 1;

    // Test hypothesis: what if this cell IS a star?
    const testState = simulateStar(state, cell);

    // Check if this leads to a contradiction
    let contradiction = false;
    let contradictionUnit: ConstrainedUnit | null = null;

    for (const unit of entangledUnits) {
      // Count remaining viable cells for this unit
      const viableCells = unit.possibleCells.filter((c) => {
        if (c.row === cell.row && c.col === cell.col) {
          // This cell is now a star, so it counts toward the unit
          return cellInUnit(c, unit);
        }
        return isViableForStar(testState, c);
      });

      const starsInUnit = countStarsInUnit(testState, unit);

      // If we have too many stars or not enough space for remaining stars
      if (starsInUnit > state.def.starsPerUnit) {
        contradiction = true;
        contradictionUnit = unit;
        break;
      }

      const starsNeeded = state.def.starsPerUnit - starsInUnit;
      if (viableCells.length < starsNeeded) {
        contradiction = true;
        contradictionUnit = unit;
        break;
      }
    }

    if (contradiction) {
      contradictionsFoundForCross += 1;
      console.log(`[ENTANGLEMENT DEBUG]     Cell (${cell.row},${cell.col}) forced to be cross (contradiction in ${formatUnit(contradictionUnit!)})`);
      forcedCells.push({ cell, kind: 'place-cross' });
    }
  }

  console.log(`[ENTANGLEMENT DEBUG]     Analysis complete: tested ${cellsTestedForStar} cells for star forcing (${contradictionsFoundForStar} contradictions), ${cellsTestedForCross} cells for cross forcing (${contradictionsFoundForCross} contradictions)`);

  return forcedCells;
}

/**
 * Simulate placing a cross at a cell
 */
function simulateCross(state: PuzzleState, cell: Coords): PuzzleState {
  const newCells = state.cells.map((row) => [...row]);
  newCells[cell.row][cell.col] = 'cross';
  return { def: state.def, cells: newCells };
}

/**
 * Simulate placing a star at a cell
 */
function simulateStar(state: PuzzleState, cell: Coords): PuzzleState {
  const newCells = state.cells.map((row) => [...row]);
  newCells[cell.row][cell.col] = 'star';
  return { def: state.def, cells: newCells };
}

/**
 * Check if a cell belongs to a unit
 */
function cellInUnit(cell: Coords, unit: ConstrainedUnit): boolean {
  if (unit.type === 'row') return cell.row === unit.id;
  if (unit.type === 'col') return cell.col === unit.id;
  // region - need to check the region map
  return false; // Simplified for now
}

/**
 * Count stars in a specific unit
 */
function countStarsInUnit(state: PuzzleState, unit: ConstrainedUnit): number {
  let cells: Coords[];

  if (unit.type === 'row') {
    cells = rowCells(state, unit.id);
  } else if (unit.type === 'col') {
    cells = colCells(state, unit.id);
  } else {
    cells = regionCells(state, unit.id);
  }

  return countStars(state, cells);
}

/**
 * Remove duplicate cells from a list
 */
function deduplicateCells(cells: Coords[]): Coords[] {
  const seen = new Set<string>();
  const result: Coords[] = [];

  for (const cell of cells) {
    const key = `${cell.row},${cell.col}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cell);
    }
  }

  return result;
}

/**
 * Format a unit for display in explanation
 */
function formatUnit(unit: ConstrainedUnit): string {
  if (unit.type === 'row') {
    return formatRow(unit.id).toLowerCase();
  } else if (unit.type === 'col') {
    return formatCol(unit.id).toLowerCase();
  } else {
    return `region ${formatRegion(unit.id)}`;
  }
}

/**
 * Filter forced cells to ensure stars are not adjacent to each other
 * If multiple stars would be placed and they're adjacent, only return the first one
 * (or return none if we can't determine which is correct)
 */
function filterValidForcedCells(state: PuzzleState, forcedCells: ForcedCell[]): ForcedCell[] {
  const starCells = forcedCells.filter((fc) => fc.kind === 'place-star');
  const crossCells = forcedCells.filter((fc) => fc.kind === 'place-cross');

  // Crosses can always be placed together, no adjacency issues
  const validCells: ForcedCell[] = [...crossCells];

  // For stars, check adjacency
  if (starCells.length === 0) {
    return validCells;
  }

  if (starCells.length === 1) {
    // Single star - check if it's adjacent to existing stars
    const star = starCells[0].cell;
    const neighbors = neighbors8(star, state.def.size);
    const hasAdjacentStar = neighbors.some((nb) => getCell(state, nb) === 'star');
    if (!hasAdjacentStar) {
      validCells.push(starCells[0]);
    }
    return validCells;
  }

  // Multiple stars - check adjacency between forced stars and against existing stars
  // Only include stars that are not adjacent to any other forced star AND not adjacent to existing stars
  for (const starCell of starCells) {
    const star = starCell.cell;
    
    // Check if this star is adjacent to any other forced star
    let isAdjacentToOtherForcedStar = false;
    for (const otherStarCell of starCells) {
      if (otherStarCell === starCell) continue;
      const otherStar = otherStarCell.cell;
      const rowDiff = Math.abs(star.row - otherStar.row);
      const colDiff = Math.abs(star.col - otherStar.col);
      if (rowDiff <= 1 && colDiff <= 1 && (rowDiff > 0 || colDiff > 0)) {
        isAdjacentToOtherForcedStar = true;
        break;
      }
    }
    
    // Check if this star is adjacent to any existing star
    const neighbors = neighbors8(star, state.def.size);
    const hasAdjacentExistingStar = neighbors.some((nb) => getCell(state, nb) === 'star');
    
    // Only add if not adjacent to other forced stars or existing stars
    if (!isAdjacentToOtherForcedStar && !hasAdjacentExistingStar) {
      validCells.push(starCell);
    }
  }

  return validCells;
}
