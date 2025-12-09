/**
 * A4 – Region vs Column-Band Star Quota (Internal Partition)
 * 
 * Symmetric to A3 but with column bands.
 * 
 * Priority: 2
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { Region, ColumnBand } from '../model/types';
import { enumerateColumnBands } from '../helpers/bandHelpers';
import { getCandidatesInRegionAndCols, getRegionBandQuota } from '../helpers/bandHelpers';
import { CellState } from '../model/types';

/**
 * A4 Schema implementation
 */
export const A4Schema: Schema = {
  id: 'A4_region_colBandPartition',
  kind: 'bandBudget',
  priority: 2,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    // Pre-compute all bands once (expensive operation)
    const allBands = enumerateColumnBands(state);

    // For each region
    for (const region of state.regions) {
      // Early exit: Skip regions that already have all stars placed
      const starsPlaced = region.cells.filter(
        cellId => state.cellStates[cellId] === CellState.Star
      ).length;
      if (starsPlaced >= region.starsRequired) continue;

      // Get all column bands that intersect this region
      const intersectingBands = allBands.filter(band => {
        const regionCellsInBand = getCandidatesInRegionAndCols(region, band.cols, state);
        return regionCellsInBand.length > 0;
      });

      // Early exit: Need at least 2 bands to partition
      if (intersectingBands.length < 2) continue;

      // Try to find a band where we can deduce the quota
      for (const targetBand of intersectingBands) {
        // Early exit: Check if target band has any candidates
        const candidatesInTargetBand = getCandidatesInRegionAndCols(
          region,
          targetBand.cols,
          state
        );
        if (candidatesInTargetBand.length === 0) continue;

        const otherBands = intersectingBands.filter(b => b !== targetBand);

        // Early exit: Need at least one other band
        if (otherBands.length === 0) continue;

        let knownQuotas = 0;
        let totalKnownQuota = 0;

        for (const band of otherBands) {
          const quota = getRegionBandQuota(region, band, state);
          if (quota > 0) {
            knownQuotas++;
            totalKnownQuota += quota;
          }
        }

        // Early exit: Can't deduce if we don't know all other quotas
        if (knownQuotas !== otherBands.length) continue;

        const regionQuota = region.starsRequired;
        const remainingStars = regionQuota - starsPlaced;
        const targetBandQuota = remainingStars - totalKnownQuota;

        // Early exit: Invalid quota
        if (targetBandQuota < 0) continue;

        if (targetBandQuota === candidatesInTargetBand.length && targetBandQuota > 0) {
              const deductions = candidatesInTargetBand.map(cell => ({
                cell,
                type: 'forceStar' as const,
              }));

              const explanation: ExplanationInstance = {
                schemaId: 'A4_region_colBandPartition',
                steps: [
                  {
                    kind: 'countRegionQuota',
                    entities: {
                      region: { kind: 'region', regionId: region.id },
                      quota: regionQuota,
                    },
                  },
                  {
                    kind: 'fixRegionBandQuota',
                    entities: {
                      region: { kind: 'region', regionId: region.id },
                      band: { kind: 'colBand', cols: targetBand.cols },
                      quota: targetBandQuota,
                    },
                  },
                ],
              };

              applications.push({
                schemaId: 'A4_region_colBandPartition',
                params: {
                  regionId: region.id,
                  targetBand: targetBand.cols,
                  quota: targetBandQuota,
                },
                deductions,
                explanation,
              });
        }
      }
    }

    return applications;
  },
};

