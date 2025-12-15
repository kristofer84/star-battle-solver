/**
 * D2 – Region × Row/Column Intersection
 * 
 * Determine when the only place a region can place its band stars
 * is at specific intersection cells.
 * 
 * Priority: 5
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { Region, RowBand, ColumnBand } from '../model/types';
import { enumerateBands } from '../helpers/bandHelpers';
import { getRegionBandQuota } from '../helpers/bandHelpers';

/**
 * Build D2 explanation
 */
function buildD2Explanation(
  region: Region,
  band: RowBand | ColumnBand,
  candidates: number[],
  quota: number
): ExplanationInstance {
  return {
    schemaId: 'D2_regionBandIntersection',
    steps: [
      {
        kind: 'countRegionQuota',
        entities: {
          region: { kind: 'region', regionId: region.id },
          band: band.type === 'rowBand'
            ? { kind: 'rowBand', rows: band.rows }
            : { kind: 'colBand', cols: band.cols },
          quota,
        },
      },
      {
        kind: 'countRemainingStars',
        entities: {
          candidates: candidates.length,
          note: 'Only these candidates remain valid',
        },
      },
    ],
  };
}

/**
 * D2 Schema implementation
 */
export const D2Schema: Schema = {
  id: 'D2_regionBandIntersection',
  kind: 'mixed',
  priority: 5,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    // For each region and band
    for (const region of state.regions) {
      const bands = enumerateBands(state);

      for (const band of bands) {
        // Get all region cells in band (including stars)
        const allCellsInBand = band.type === 'rowBand'
          ? region.cells.filter(cellId => {
              const row = Math.floor(cellId / state.size);
              return band.rows.includes(row);
            })
          : region.cells.filter(cellId => {
              const col = cellId % state.size;
              return band.cols.includes(col);
            });
        
        // Get unknown cells (candidates) in band
        const candidates = allCellsInBand.filter(c => state.cellStates[c] === 0);
        // Count stars already placed in band
        const starsInBand = allCellsInBand.filter(c => state.cellStates[c] === 1).length;
        
        const q = getRegionBandQuota(region, band, state);
        // Remaining stars needed = total quota - already placed
        const remainingStarsNeeded = q - starsInBand;

        // Case 1: Exact match - candidate count equals remaining stars needed
        // All remaining candidates must be stars
        if (candidates.length === remainingStarsNeeded && remainingStarsNeeded > 0) {
          const deductions = candidates.map(c => ({ cell: c, type: 'forceStar' as const }));

          applications.push({
            schemaId: 'D2_regionBandIntersection',
            params: {
              regionId: region.id,
              band: band.type === 'rowBand' ? band.rows : band.cols,
              bandType: band.type,
              quota: q,
            },
            deductions,
            explanation: buildD2Explanation(region, band, candidates, q),
          });
        }
      }
    }

    return applications;
  },
};

