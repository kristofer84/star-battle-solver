/**
 * Schema-Based Technique
 * 
 * Uses the schema-based logical engine to find hints.
 * This integrates the new schema system with the existing technique framework.
 */

import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, CellDeduction } from '../../types/deductions';
import type { SchemaApplication } from '../schemas/types';
import { findBestSchemaApplication, getAllSchemaApplications } from '../schemas/runtime';
import { verifyAndBuildSchemaHint, verifyForcedCell } from '../schemas/verification/schemaHintVerifier';
import { validateState } from '../validation';
import { getSolveSignal } from '../../store/puzzleStore';
// Ensure schemas are registered when this technique is loaded
import { initSchemas } from '../schemas/index';
initSchemas();
/**
 * Find hint using schema-based system
 */
export async function findSchemaBasedHint(state: PuzzleState): Promise<Hint | null> {
  console.log('[DEBUG] findSchemaBasedHint called')
  const startTime = performance.now();
  const best = await findBestSchemaApplication(state);
  const totalTime = performance.now() - startTime;

  // Log debug info if it takes significant time
  if (totalTime > 50) {
    console.log(`[SCHEMA-BASED DEBUG] Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`[SCHEMA-BASED DEBUG] Best application found: ${best ? 'YES' : 'NO'}`);
  }

  if (!best) return null;

  const verified = await verifyAndBuildSchemaHint(
    state,
    best.app,
    best.baseExplanation,
    best.baseHighlights,
    {
      perCheckTimeoutMs: 250,
      maxSolutionsToFind: 1,
      signal: getSolveSignal() ?? undefined,
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
 * Verify a limited number of schema deductions and return them
 */
async function verifySchemaDeductions(
  state: PuzzleState,
  applications: SchemaApplication[],
  maxDeductions: number = 10
): Promise<Deduction[]> {
  const verifiedDeductions: Deduction[] = [];
  const signal = getSolveSignal() ?? undefined;

  for (const app of applications) {
    if (verifiedDeductions.length >= maxDeductions) break;
    if (signal?.aborted) break;

    // Try to verify each deduction in this application
    for (const ded of app.deductions) {
      if (verifiedDeductions.length >= maxDeductions) break;
      if (signal?.aborted) break;

      const row = Math.floor(ded.cell / state.def.size);
      const col = ded.cell % state.def.size;
      const currentValue = state.cells[row][col];

      // Skip if cell is already filled
      if (currentValue !== 'empty') continue;

      const assignment = {
        row,
        col,
        value: ded.type === 'forceStar' ? 'star' as const : 'cross' as const,
      };

      // Verify this deduction
      const verified = await verifyForcedCell(state, assignment, {
        perCheckTimeoutMs: 100, // Shorter timeout for batch verification
        maxSolutionsToFind: 1,
        signal,
      });

      if (verified.status === 'proved') {
        verifiedDeductions.push({
          kind: 'cell',
          technique: 'schema-based',
          cell: { row, col },
          type: ded.type === 'forceStar' ? 'forceStar' : 'forceEmpty',
          explanation: `Schema ${app.schemaId}: verified ${ded.type === 'forceStar' ? 'star' : 'cross'} at (${row},${col})`,
        });
      }
    }
  }

  return verifiedDeductions;
}

/**
 * Find result with deductions support
 */
export async function findSchemaBasedResult(state: PuzzleState): Promise<TechniqueResult> {
  // Try to find a verified hint first (this only returns verified deductions)
  const hint = await findSchemaBasedHint(state);
  if (hint) {
    // Only return verified hints - don't pass unverified deductions to main solver
    return { type: 'hint', hint };
  }

  // If no single verified hint, try to verify a limited number of deductions
  // This allows the main solver to combine verified deductions from multiple schemas
  const applications = await getAllSchemaApplications(state);
  if (applications.length === 0) {
    return { type: 'none' };
  }

  // Verify up to 10 deductions (main solver has a limit of 10 cells per hint)
  const verifiedDeductions = await verifySchemaDeductions(state, applications, 10);
  
  if (verifiedDeductions.length > 0) {
    return { type: 'deductions', deductions: verifiedDeductions };
  }

  return { type: 'none' };
}

