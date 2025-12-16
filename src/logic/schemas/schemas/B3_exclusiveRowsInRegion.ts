/**
 * B3 – Exclusive Rows Inside a Region
 * 
 * Within a region, all candidate cells lie in a small set of rows.
 * Some rows are fully dedicated to the region for stars.
 * By counting required stars and existing placements,
 * deduce how many stars must go into each row.
 * 
 * Priority: 3
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { Region } from '../model/types';
import { getCandidatesInRegionAndRows } from '../helpers/bandHelpers';
import { getStarsRemainingInGroup, getCandidatesInGroup } from '../helpers/groupHelpers';
import { CellState } from '../model/types';

/**
 * Build B3 explanation
 */
function buildB3Explanation(
  region: Region,
  rows: number[],
  quotas: Map<number, number>,
  state: any
): ExplanationInstance {
  return {
    schemaId: 'B3_exclusiveRows_region',
    steps: [
      {
        kind: 'countRegionQuota',
        entities: {
          region: { kind: 'region', regionId: region.id },
          remainingStars: getStarsRemainingInGroup(
            {
              kind: 'region',
              id: `region_${region.id}`,
              cells: region.cells,
              starsRequired: region.starsRequired,
            },
            state
          ),
        },
      },
      {
        kind: 'fixRegionBandQuota',
        entities: {
          region: { kind: 'region', regionId: region.id },
          rows,
          quotas: Array.from(quotas.entries()).map(([row, quota]) => ({
            row,
            quota,
          })),
        },
      },
    ],
  };
}

/**
 * B3 Schema implementation
 */
export const B3Schema: Schema = {
  id: 'B3_exclusiveRows_region',
  kind: 'exclusiveArea',
  priority: 3,
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    // For each region
    for (const region of state.regions) {
      const candidates = getCandidatesInGroup(
        {
          kind: 'region',
          id: `region_${region.id}`,
          cells: region.cells,
          starsRequired: region.starsRequired,
        },
        state
      );

      if (candidates.length === 0) continue;

      // Find which rows contain candidate cells
      const rowsWithCandidates = new Set<number>();
      for (const cellId of candidates) {
        const row = Math.floor(cellId / state.size);
        rowsWithCandidates.add(row);
      }

      const rows = Array.from(rowsWithCandidates).sort((a, b) => a - b);

      // If we have a small set of rows (B3 emphasizes this)
      if (rows.length > 4) {
        continue; // B3 is most useful with small sets
      }

      // Check if we can deduce star quotas per row
      const remainingStars = getStarsRemainingInGroup(
        {
          kind: 'region',
          id: `region_${region.id}`,
          cells: region.cells,
          starsRequired: region.starsRequired,
        },
        state
      );

      if (remainingStars <= 0) continue;

      // For each row, count candidates
      const rowCandidates = new Map<number, number[]>();
      for (const row of rows) {
        const rowCands = getCandidatesInRegionAndRows(region, [row], state);
        rowCandidates.set(row, rowCands);
      }

      // If total candidates across rows equals remaining stars, all must be stars
      const totalCandidates = Array.from(rowCandidates.values()).reduce(
        (sum, cands) => sum + cands.length,
        0
      );

      if (totalCandidates === remainingStars) {
        const allCandidates = Array.from(rowCandidates.values()).flat();
        const deductions = allCandidates.map(cell => ({
          cell,
          type: 'forceStar' as const,
        }));

        const quotas = new Map<number, number>();
        for (const [row, cands] of rowCandidates.entries()) {
          quotas.set(row, cands.length);
        }

        const explanation = buildB3Explanation(region, rows, quotas, state);

        applications.push({
          schemaId: 'B3_exclusiveRows_region',
          params: {
            regionId: region.id,
            rows,
            quotas: Object.fromEntries(quotas),
          },
          deductions,
          explanation,
        });
      }
    }

    return applications;
  },
};

