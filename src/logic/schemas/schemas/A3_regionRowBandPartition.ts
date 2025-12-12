/**
 * A3 – Region vs Row-Band Star Quota (Internal Partition)
 * 
 * Inside a region, its cells are partitioned by row bands.
 * If quotas in some bands are known, deduce the quota for the remaining band.
 * 
 * Priority: 2
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { Region, RowBand } from '../model/types';
import { enumerateRowBands } from '../helpers/bandHelpers';
import { getCandidatesInRegionAndRows, getRegionBandQuota } from '../helpers/bandHelpers';
import { getStarCountInCells } from '../helpers/cellHelpers';
import { CellState } from '../model/types';

/**
 * A3 Schema implementation
 */
export const A3Schema: Schema = {
  id: 'A3_region_rowBandPartition',
  kind: 'bandBudget',
  priority: 2,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const size = state.size;

    // Pre-compute all bands once (expensive operation)
    const allBands = enumerateRowBands(state);

    // For each region
    for (const region of state.regions) {
      // Early exit: Skip regions that already have all stars placed
      const starsPlaced = region.cells.filter(
        cellId => state.cellStates[cellId] === CellState.Star
      ).length;
      if (starsPlaced >= region.starsRequired) continue;

      // Get all row bands that intersect this region
      const intersectingBands = allBands.filter(band => {
        const regionCellsInBand = getCandidatesInRegionAndRows(region, band.rows, state);
        return regionCellsInBand.length > 0;
      });

      // Early exit: Need at least 2 bands to partition
      if (intersectingBands.length < 2) continue;

      // Try to find a band where we can deduce the quota
      // by knowing quotas of all other bands
      for (const targetBand of intersectingBands) {
        // Early exit: Check if target band has any candidates
        const candidatesInTargetBand = getCandidatesInRegionAndRows(
          region,
          targetBand.rows,
          state
        );
        if (candidatesInTargetBand.length === 0) continue;

        const otherBands = intersectingBands.filter(b => b !== targetBand);

        // Early exit: Need at least one other band
        if (otherBands.length === 0) continue;

        // Check if we know quotas for all other bands
        // (Simplified - full implementation would track deduced quotas)
        let knownQuotas = 0;
        let totalKnownQuota = 0;

        for (const band of otherBands) {
          const cand = getCandidatesInRegionAndRows(region, band.rows, state);
          if (cand.length === 0) continue; // quota irrelevant for deduction          

          const quota = getRegionBandQuota(region, band, state);
          // If quota is known (not 0 or matches some pattern), count it
          // This is simplified - real implementation needs quota tracking
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

        // If quota equals candidate count, force all to stars
        if (targetBandQuota === candidatesInTargetBand.length && targetBandQuota > 0) {
          const deductions = candidatesInTargetBand.map(cell => ({
            cell,
            type: 'forceStar' as const,
          }));

          const explanation: ExplanationInstance = {
            schemaId: 'A3_region_rowBandPartition',
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
                  band: { kind: 'rowBand', rows: targetBand.rows },
                  quota: targetBandQuota,
                },
              },
            ],
          };

          applications.push({
            schemaId: 'A3_region_rowBandPartition',
            params: {
              regionId: region.id,
              targetBand: targetBand.rows,
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

