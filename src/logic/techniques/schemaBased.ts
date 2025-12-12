/**
 * Schema-Based Technique
 * 
 * Uses the schema-based logical engine to find hints.
 * This integrates the new schema system with the existing technique framework.
 */

import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, CellDeduction } from '../../types/deductions';
import { findBestSchemaApplication, getAllSchemaApplications } from '../schemas/runtime';
import { verifyAndBuildSchemaHint } from '../schemas/verification/schemaHintVerifier';
import { validateState } from '../validation';
// Ensure schemas are registered when this technique is loaded
import '../schemas/index';

/**
 * Find hint using schema-based system
 */
export function findSchemaBasedHint(state: PuzzleState): Hint | null {
  const startTime = performance.now();
  const best = findBestSchemaApplication(state);
  const totalTime = performance.now() - startTime;

  // Log debug info if it takes significant time
  if (totalTime > 50) {
    console.log(`[SCHEMA-BASED DEBUG] Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`[SCHEMA-BASED DEBUG] Best application found: ${best ? 'YES' : 'NO'}`);
  }

  if (!best) return null;

  const verified = verifyAndBuildSchemaHint(
    state,
    best.app,
    best.baseExplanation,
    best.baseHighlights,
    {
      perCheckTimeoutMs: 250,
      maxSolutionsToFind: 1,
    }
  );

  if (verified.kind !== 'verified-hint') {
    return null;
  }

  // Keep the existing defensive validateState block as a final guard.
  // It should almost never filter out a proved hint, but it is fine as a safety net.
  const hint = verified.hint;
  if (hint.resultCells.length !== 1) return null;

  const { row, col } = hint.resultCells[0];
  const targetValue = hint.kind === 'place-star' ? 'star' : 'cross';
  const currentValue = state.cells[row][col];
  if (currentValue !== 'empty' && currentValue !== targetValue) return null;

  const candidateCells = state.cells.map(r => [...r]);
  candidateCells[row][col] = targetValue;
  if (validateState({ ...state, cells: candidateCells }).length > 0) {
    return null;
  }

  // IMPORTANT: Do not reintroduce multi-cell schema hints until you also verify
  // multi-cell forcedness cell-by-cell.
  return hint;
}

/**
 * Find result with deductions support
 */
export function findSchemaBasedResult(state: PuzzleState): TechniqueResult {
  // Get all schema applications and convert to deductions first
  const applications = getAllSchemaApplications(state);
  const deductions: Deduction[] = [];

  for (const app of applications) {
    for (const ded of app.deductions) {
      const row = Math.floor(ded.cell / state.def.size);
      const col = ded.cell % state.def.size;
      
      deductions.push({
        kind: 'cell',
        technique: 'schema-based',
        cell: { row, col },
        type: ded.type === 'forceStar' ? 'forceStar' : 'forceEmpty',
        explanation: `Schema ${app.schemaId}: ${ded.type === 'forceStar' ? 'star' : 'empty'} at (${row},${col})`,
      });
    }
  }

  // Try to find a clear hint
  const hint = findSchemaBasedHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}

