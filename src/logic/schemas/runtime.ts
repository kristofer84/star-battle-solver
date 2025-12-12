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
export function findBestSchemaApplication(
  state: PuzzleState
): { app: SchemaApplication; baseExplanation: string; baseHighlights?: HintHighlight } | null {
  const startTime = performance.now();
  const schemaTimings: Record<string, number> = {};
  const schemaApplicationCounts: Record<string, number> = {};
  let totalSchemasChecked = 0;
  const HARD_BUDGET_MS = 30;
  
  // Clear packing cache at start of each schema application
  // (state has changed, so previous cache entries are invalid)
  clearPackingCache();
  
  // Convert to board state
  const boardState = puzzleStateToBoardState(state);
  
  // Create schema context
  const ctx: SchemaContext = {
    state: boardState,
  };
  
  // Apply schemas with timing + hard global budget
  const allSchemas = getAllSchemas();
  const allApplications: SchemaApplication[] = [];
  
  for (const schema of allSchemas) {
    totalSchemasChecked++;
    const schemaStartTime = performance.now();
    try {
      const applications = schema.apply(ctx);
      const schemaTime = performance.now() - schemaStartTime;
      schemaTimings[schema.id] = schemaTime;
      schemaApplicationCounts[schema.id] = applications.length;
      allApplications.push(...applications);
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
  
  let applications = allApplications;
  
  // Schema-based pattern matching is disabled.
  // The entanglement patterns technique (entanglementPatterns.ts) works well
  // and is separate from this schema-based pattern system.
  // Schema-based patterns require more sophisticated validation to ensure they match
  // the logical structure (region IDs, quotas, band configurations) correctly.
  // For now, we rely on direct schema implementations which work correctly.
  // const patternApplications = getAllPatternApplications(ctx);
  // applications = [...applications, ...patternApplications];
  
  // Filter out applications with no valid deductions (cells already filled)
  // Create new application objects to avoid mutating the original
  const filteringStartTime = performance.now();
  let totalDeductionsBefore = 0;
  let totalDeductionsAfter = 0;
  const schemaFilterStats: Record<string, { before: number; after: number; appsBefore: number; appsAfter: number }> = {};
  
  applications = applications.map(app => {
    const beforeCount = app.deductions.length;
    totalDeductionsBefore += beforeCount;
    
    if (!schemaFilterStats[app.schemaId]) {
      schemaFilterStats[app.schemaId] = { before: 0, after: 0, appsBefore: 0, appsAfter: 0 };
    }
    schemaFilterStats[app.schemaId].before += beforeCount;
    schemaFilterStats[app.schemaId].appsBefore++;
    
    const validDeductions = app.deductions.filter(ded => {
      const row = Math.floor(ded.cell / state.def.size);
      const col = ded.cell % state.def.size;
      const currentValue = state.cells[row][col];
      
      // Skip if cell is already filled with the same value
      if (ded.type === 'forceStar' && currentValue === 'star') return false;
      if (ded.type === 'forceEmpty' && currentValue === 'cross') return false;
      
      // Skip if deduction conflicts with current state
      if (ded.type === 'forceStar' && currentValue === 'cross') return false;
      if (ded.type === 'forceEmpty' && currentValue === 'star') return false;
      
      return true; // Valid deduction
    });
    
    const afterCount = validDeductions.length;
    totalDeductionsAfter += afterCount;
    schemaFilterStats[app.schemaId].after += afterCount;
    if (afterCount > 0) {
      schemaFilterStats[app.schemaId].appsAfter++;
    }
    
    // Return a new application object with filtered deductions
    return {
      ...app,
      deductions: validDeductions,
    };
  }).filter(app => app.deductions.length > 0);
  
  const filteringTime = performance.now() - filteringStartTime;
  
  const totalTime = performance.now() - startTime;
  
  // Log debug info if it takes significant time or many schemas checked
  if (totalTime > 50 || totalSchemasChecked > 10) {
    const appsBeforeFilter = allApplications.length;
    const appsAfterFilter = applications.length;
    
    console.log(`[SCHEMA-BASED DEBUG] Total time: ${totalTime.toFixed(2)}ms, Schemas checked: ${totalSchemasChecked}`);
    console.log(`[SCHEMA-BASED DEBUG] Applications: ${appsBeforeFilter} found → ${appsAfterFilter} valid (${appsBeforeFilter - appsAfterFilter} filtered)`);
    console.log(`[SCHEMA-BASED DEBUG] Deductions: ${totalDeductionsBefore} found → ${totalDeductionsAfter} valid (${totalDeductionsBefore - totalDeductionsAfter} filtered)`);
    console.log(`[SCHEMA-BASED DEBUG] Filtering time: ${filteringTime.toFixed(2)}ms`);
    
    // Show timing breakdown for schemas that took time or found applications
    const significantSchemas = Object.entries(schemaTimings)
      .filter(([id, time]) => time > 5 || (schemaApplicationCounts[id] || 0) > 0)
      .sort((a, b) => b[1] - a[1]); // Sort by time descending
    
    if (significantSchemas.length > 0) {
      console.log(`[SCHEMA-BASED DEBUG] Schema timing breakdown (ms):`, 
        Object.fromEntries(
          significantSchemas.map(([id, time]) => [id, time.toFixed(2)])
        )
      );
      console.log(`[SCHEMA-BASED DEBUG] Schema application counts (before filter):`, 
        Object.fromEntries(
          significantSchemas.map(([id]) => [id, schemaApplicationCounts[id] || 0])
        )
      );
      
      // Show which schemas found nothing vs found something
      const schemasWithNoResults = Object.entries(schemaTimings)
        .filter(([id, time]) => time > 100 && (schemaApplicationCounts[id] || 0) === 0)
        .sort((a, b) => b[1] - a[1]);
      
      if (schemasWithNoResults.length > 0) {
        console.log(`[SCHEMA-BASED DEBUG] ⚠️ Schemas taking time but finding 0 applications:`, 
          Object.fromEntries(
            schemasWithNoResults.map(([id, time]) => [id, `${time.toFixed(2)}ms`])
          )
        );
      }
      
      const schemasWithAllFiltered = Object.entries(schemaFilterStats)
        .filter(([id, stats]) => stats.appsBefore > 0 && stats.appsAfter === 0)
        .map(([id]) => id);
      
      if (schemasWithAllFiltered.length > 0) {
        console.log(`[SCHEMA-BASED DEBUG] ⚠️ Schemas where ALL applications were filtered:`, schemasWithAllFiltered.join(', '));
      }
      
      // Show filtering stats for schemas that had many applications filtered
      const filteredSchemas = Object.entries(schemaFilterStats)
        .filter(([id, stats]) => stats.appsBefore > stats.appsAfter || stats.before > stats.after)
        .sort((a, b) => (b[1].before - b[1].after) - (a[1].before - a[1].after));
      
      if (filteredSchemas.length > 0) {
        console.log(`[SCHEMA-BASED DEBUG] Schema filtering stats (apps: before→after, deductions: before→after):`, 
          Object.fromEntries(
            filteredSchemas.map(([id, stats]) => [
              id, 
              `${stats.appsBefore}→${stats.appsAfter}, ${stats.before}→${stats.after}`
            ])
          )
        );
      }
    }
  }

  if (applications.length === 0) return null;

  // Debug: Log which schema produced the hint
  const firstApp = applications[0];
  if (firstApp.deductions.length > 10) {
    console.warn(`[SCHEMA DEBUG] Schema ${firstApp.schemaId} produced ${firstApp.deductions.length} deductions:`, 
      firstApp.deductions.slice(0, 5).map(d => {
        const row = Math.floor(d.cell / state.def.size);
        const col = d.cell % state.def.size;
        return `${d.type}@(${row},${col})`;
      }).join(', '), '...');
  }

  const app = applications[0];
  const { baseExplanation, baseHighlights } = buildSchemaNarrative(app, state);
  return { app, baseExplanation, baseHighlights };
}

/**
 * Get all schema applications (for deduction collection)
 */
export function getAllSchemaApplications(state: PuzzleState): SchemaApplication[] {
  clearPackingCache();
  const boardState = puzzleStateToBoardState(state);
  const ctx: SchemaContext = { state: boardState };
  const allSchemas = getAllSchemas();
  const allApplications: SchemaApplication[] = [];

  for (const schema of allSchemas) {
    try {
      const applications = schema.apply(ctx);
      allApplications.push(...applications);
    } catch (error) {
      console.warn(`Error applying schema ${schema.id}:`, error);
    }
  }

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

