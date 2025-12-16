/**
 * Runtime schema application system
 * Integrates with the existing solver hint system
 */

import type { PuzzleState } from '../../types/puzzle';
import type { HintHighlight } from '../../types/hints';
import { puzzleStateToBoardState } from './model/state';
import { getAllSchemas } from './registry';
import type { SchemaApplication, SchemaContext } from './types';
import { renderExplanation } from './explanations/templates';
import { clearPackingCache } from './helpers/blockPacking';
import { store } from '../../store/puzzleStore';

/**
 * Convert schema application to hint format
 */
function schemaApplicationToHint(app: SchemaApplication, state: PuzzleState): {
  id: string;
  technique: 'schema-based';
  explanation: string;
  forcedStars: Array<{ row: number; col: number }>;
  forcedCrosses: Array<{ row: number; col: number }>;
  highlights?: HintHighlight;
} {
  const { def } = state;

  // Convert deductions to hint format
  const forcedStars: Array<{ row: number; col: number }> = [];
  const forcedCrosses: Array<{ row: number; col: number }> = [];

  for (const deduction of app.deductions) {
    const row = Math.floor(deduction.cell / def.size);
    const col = deduction.cell % def.size;

    if (deduction.type === 'forceStar') {
      forcedStars.push({ row, col });
    } else {
      forcedCrosses.push({ row, col });
    }
  }

  // Build explanation text using templates
  const ctx: SchemaContext = {
    state: puzzleStateToBoardState(state),
  };
  const explanationLines = renderExplanation(app.explanation, ctx);

  // Extract highlights from explanation entities
  const highlights: HintHighlight = {
    cells: [],
    rows: [],
    cols: [],
    regions: [],
  };

  for (const step of app.explanation.steps) {
    if (step.entities.band) {
      if (step.entities.band.rows) {
        highlights.rows?.push(...step.entities.band.rows);
      }
      if (step.entities.band.cols) {
        highlights.cols?.push(...step.entities.band.cols);
      }
    }
    if (step.entities.regions) {
      const regionIds = (step.entities.regions as any[])
        .map((r: any) => r.regionId)
        .filter((id: any) => id !== undefined);
      highlights.regions?.push(...regionIds);
    }
    if (step.entities.region) {
      highlights.regions?.push((step.entities.region as any).regionId);
    }
  }

  // Add deduction cells to highlights
  for (const deduction of app.deductions) {
    const row = Math.floor(deduction.cell / def.size);
    const col = deduction.cell % def.size;
    highlights.cells?.push({ row, col });
  }

  return {
    id: `schema-${app.schemaId}-${Date.now()}`,
    technique: 'schema-based',
    explanation: explanationLines.join(' ') || `Schema ${app.schemaId} found ${app.deductions.length} deduction(s)`,
    forcedStars,
    forcedCrosses,
    highlights: highlights.cells?.length || highlights.rows?.length || highlights.cols?.length || highlights.regions?.length
      ? highlights
      : undefined,
  };
}

/**
 * Build schema narrative (explanation + visual highlights), without forcing moves.
 */
export function buildSchemaNarrative(
  app: SchemaApplication,
  state: PuzzleState
): { baseExplanation: string; baseHighlights?: HintHighlight } {
  const ctx: SchemaContext = { state: puzzleStateToBoardState(state) };
  const explanationLines = renderExplanation(app.explanation, ctx);

  const highlights: HintHighlight = { cells: [], rows: [], cols: [], regions: [] };

  for (const step of app.explanation.steps) {
    if (step.entities.band) {
      if (step.entities.band.rows) highlights.rows?.push(...step.entities.band.rows);
      if (step.entities.band.cols) highlights.cols?.push(...step.entities.band.cols);
    }
    if (step.entities.regions) {
      const regionIds = (step.entities.regions as any[])
        .map((r: any) => r.regionId)
        .filter((id: any) => id !== undefined);
      highlights.regions?.push(...regionIds);
    }
    if (step.entities.region) {
      highlights.regions?.push((step.entities.region as any).regionId);
    }
  }

  // Do NOT add deduction cells here; the verifier will add the final result cell.
  const baseHighlights =
    (highlights.cells?.length || highlights.rows?.length || highlights.cols?.length || highlights.regions?.length)
      ? highlights
      : undefined;

  return {
    baseExplanation: explanationLines.join(' ') || `Schema ${app.schemaId} found ${app.deductions.length} candidate deduction(s).`,
    baseHighlights,
  };
}

/**
 * Find the best schema application (candidate deductions + narrative).
 *
 * IMPORTANT: This does NOT emit forced moves directly. The technique wrapper
 * must verify forcedness before returning a user hint.
 */
export async function findBestSchemaApplication(
  state: PuzzleState
): Promise<{ app: SchemaApplication; baseExplanation: string; baseHighlights?: HintHighlight } | null> {
  const startTime = performance.now();
  const schemaTimings: Record<string, number> = {};
  const schemaApplicationCounts: Record<string, number> = {};
  let totalSchemasChecked = 0;
  const HARD_BUDGET_MS = 30;
  const signal = store.solveAbortController?.signal ?? null;

  // Clear packing cache at start of each schema application
  // (state has changed, so previous cache entries are invalid)
  clearPackingCache();
  console.log('[DEBUG] Starting schema application')

  // Convert to board state
  const boardState = puzzleStateToBoardState(state);
  console.log('[DEBUG] Board state created')
  // Create schema context
  const ctx: SchemaContext = {
    state: boardState,
  };

  // Apply schemas with timing + hard global budget
  const allSchemas = getAllSchemas();
  console.log('[DEBUG] All schemas created', allSchemas.length)

  // Store original technique name to restore later
  const originalTechnique = store.currentTechnique;

  for (const schema of allSchemas) {
    if (signal?.aborted) {
      store.currentTechnique = originalTechnique;
      return null;
    }
    totalSchemasChecked++;
    const schemaStartTime = performance.now();
    
    // Update UI to show current schema being tested
    store.currentTechnique = `Schema: ${schema.id}`;
    
    // Yield to allow UI to update (but only occasionally to avoid too much overhead)
    if (totalSchemasChecked % 3 === 0) {
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });
    }
    if (signal?.aborted) {
      store.currentTechnique = originalTechnique;
      return null;
    }
    
    try {
      let applications = await schema.apply(ctx);
      const schemaTime = performance.now() - schemaStartTime;
      schemaTimings[schema.id] = schemaTime;
      schemaApplicationCounts[schema.id] = applications.length;

      // Filter deductions immediately (so we can early-exit on real work)
      applications = applications
        .map(app => ({
          ...app,
          deductions: app.deductions.filter(ded => {
            const row = Math.floor(ded.cell / state.def.size);
            const col = ded.cell % state.def.size;
            const cur = state.cells[row][col];
            if (ded.type === 'forceStar' && (cur === 'star' || cur === 'cross')) return false;
            if (ded.type === 'forceEmpty' && (cur === 'cross' || cur === 'star')) return false;
            return true;
          }),
        }))
        .filter(app => app.deductions.length > 0);

      if (applications.length > 0) {
        const app = applications[0];
        const { baseExplanation, baseHighlights } = buildSchemaNarrative(app, state);
        console.log('[DEBUG] Best schema application found', schema.id, 'schema time', performance.now() - startTime)
        // Restore original technique name
        store.currentTechnique = originalTechnique;
        return { app, baseExplanation, baseHighlights };
      }
      console.log('[DEBUG] Schema application not found', schema.id, 'schema time', performance.now() - startTime)
    } catch (error) {
      const schemaTime = performance.now() - schemaStartTime;
      schemaTimings[schema.id] = schemaTime;
      schemaApplicationCounts[schema.id] = 0;
      console.warn(`Error applying schema ${schema.id}:`, error);
    }

    if (performance.now() - startTime > HARD_BUDGET_MS) {
      break;
    }
  }

  // Restore original technique name
  store.currentTechnique = originalTechnique;
  return null;
}

/**
 * Get all schema applications (for deduction collection)
 * Updates store.currentTechnique with schema IDs during testing
 */
export async function getAllSchemaApplications(state: PuzzleState): Promise<SchemaApplication[]> {
  clearPackingCache();
  const boardState = puzzleStateToBoardState(state);
  const ctx: SchemaContext = { state: boardState };
  const allSchemas = getAllSchemas();
  const allApplications: SchemaApplication[] = [];
  const signal = store.solveAbortController?.signal ?? null;

  // Store original technique name to restore later
  const originalTechnique = store.currentTechnique;

  for (const schema of allSchemas) {
    if (signal?.aborted) {
      break;
    }
    try {
      // Update UI to show current schema being tested
      store.currentTechnique = `Schema: ${schema.id}`;
      
      // Yield to allow UI to update
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });
      if (signal?.aborted) {
        break;
      }

      console.log(`[SCHEMA] ${schema.id} starting`);
      const t0 = performance.now();
      const applications = await schema.apply(ctx);
      console.log(`[SCHEMA] ${schema.id} completed in ${(performance.now() - t0).toFixed(1)}ms`);
      allApplications.push(...applications);
    } catch (error) {
      console.warn(`Error applying schema ${schema.id}:`, error);
    }
  }

  // Restore original technique name (or null if it was null)
  store.currentTechnique = originalTechnique;

  // Filter out applications with no valid deductions
  return allApplications.map(app => {
    const validDeductions = app.deductions.filter(ded => {
      const row = Math.floor(ded.cell / state.def.size);
      const col = ded.cell % state.def.size;
      const currentValue = state.cells[row][col];

      if (ded.type === 'forceStar' && currentValue === 'star') return false;
      if (ded.type === 'forceEmpty' && currentValue === 'cross') return false;
      if (ded.type === 'forceStar' && currentValue === 'cross') return false;
      if (ded.type === 'forceEmpty' && currentValue === 'star') return false;

      return true;
    });

    return {
      ...app,
      deductions: validDeductions,
    };
  }).filter(app => app.deductions.length > 0);
}

/**
 * Apply schema deductions to puzzle state
 * Returns new state with deductions applied
 */
export function applySchemaDeductions(
  state: PuzzleState,
  applications: SchemaApplication[]
): PuzzleState {
  const newCells = state.cells.map(row => [...row]);

  for (const app of applications) {
    for (const deduction of app.deductions) {
      const row = Math.floor(deduction.cell / state.def.size);
      const col = deduction.cell % state.def.size;

      if (deduction.type === 'forceStar') {
        newCells[row][col] = 'star';
      } else {
        newCells[row][col] = 'cross';
      }
    }
  }

  return {
    ...state,
    cells: newCells,
  };
}

