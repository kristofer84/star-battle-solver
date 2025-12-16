/**
 * B4 – Exclusive Columns Inside a Region
 * 
 * Symmetric to B3 but with columns.
 * 
 * Priority: 3
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { Region } from '../model/types';
import { getCandidatesInRegionAndCols } from '../helpers/bandHelpers';
import { getStarsRemainingInGroup, getCandidatesInGroup } from '../helpers/groupHelpers';

/**
 * Build B4 explanation (symmetric to B3)
 */
function buildB4Explanation(
  region: Region,
  cols: number[],
  quotas: Map<number, number>,
  state: any
): ExplanationInstance {
  return {
    schemaId: 'B4_exclusiveCols_region',
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
          cols,
          quotas: Array.from(quotas.entries()).map(([col, quota]) => ({
            col,
            quota,
          })),
        },
      },
    ],
  };
}

/**
 * B4 Schema implementation
 */
export const B4Schema: Schema = {
  id: 'B4_exclusiveCols_region',
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

      // Find which columns contain candidate cells
      const colsWithCandidates = new Set<number>();
      for (const cellId of candidates) {
        const col = cellId % state.size;
        colsWithCandidates.add(col);
      }

      const cols = Array.from(colsWithCandidates).sort((a, b) => a - b);

      // If we have a small set of columns (B4 emphasizes this)
      if (cols.length > 4) {
        continue;
      }

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

      // For each column, count candidates
      const colCandidates = new Map<number, number[]>();
      for (const col of cols) {
        const colCands = getCandidatesInRegionAndCols(region, [col], state);
        colCandidates.set(col, colCands);
      }

      // If total candidates across columns equals remaining stars, all must be stars
      const totalCandidates = Array.from(colCandidates.values()).reduce(
        (sum, cands) => sum + cands.length,
        0
      );

      if (totalCandidates === remainingStars) {
        const allCandidates = Array.from(colCandidates.values()).flat();
        const deductions = allCandidates.map(cell => ({
          cell,
          type: 'forceStar' as const,
        }));

        const quotas = new Map<number, number>();
        for (const [col, cands] of colCandidates.entries()) {
          quotas.set(col, cands.length);
        }

        const explanation = buildB4Explanation(region, cols, quotas, state);

        applications.push({
          schemaId: 'B4_exclusiveCols_region',
          params: {
            regionId: region.id,
            cols,
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

