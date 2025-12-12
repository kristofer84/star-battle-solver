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
    const bandRanges = allBands.map(band => ({
      band,
      startRow: band.rows[0],
      endRow: band.rows[band.rows.length - 1],
    }));

    // For each region
    for (const region of state.regions) {
      // Early exit: Skip regions that already have all stars placed
      let starsPlaced = 0;
      let allCandidatesCount = 0;
      for (const cellId of region.cells) {
        const cellState = state.cellStates[cellId];
        if (cellState === CellState.Star) {
          starsPlaced += 1;
        } else if (cellState === CellState.Unknown) {
          allCandidatesCount += 1;
        }
      }
      if (starsPlaced >= region.starsRequired) continue;

      const remainingInRegion = region.starsRequired - starsPlaced;

      // Compute candidate counts in each band without allocating arrays.
      const intersectingBandRanges: Array<(typeof bandRanges)[number] & { candidatesInBandCount: number; starsInBand: number }> = [];

      for (const br of bandRanges) {
        let candidatesInBandCount = 0;
        let starsInBand = 0;
        for (const cellId of region.cells) {
          const row = Math.floor(cellId / size);
          if (row < br.startRow || row > br.endRow) continue;
          const cellState = state.cellStates[cellId];
          if (cellState === CellState.Unknown) {
            candidatesInBandCount += 1;
          } else if (cellState === CellState.Star) {
            starsInBand += 1;
          }
        }
        if (candidatesInBandCount > 0) {
          intersectingBandRanges.push({ ...br, candidatesInBandCount, starsInBand });
        }
      }

      // Early exit: Need at least 2 bands to partition
      if (intersectingBandRanges.length < 2) continue;

      // Cache quotas per band for this region to avoid recomputation.
      const quotaByBandKey = new Map<string, number>();

      function quotaForBand(br: { band: RowBand; startRow: number; endRow: number; starsInBand: number; candidatesInBandCount: number }): number {
        const key = `${br.startRow}-${br.endRow}`;
        const cached = quotaByBandKey.get(key);
        if (cached !== undefined) {
          return cached;
        }

        // Use the same cutoff behavior as `getRegionBandQuota` to avoid wasted work.
        // When the region has too many candidates overall, `getRegionBandQuota` returns `starsInBand`.
        const MAX_CANDIDATES_FOR_QUOTA = 16;
        let quota = br.starsInBand;
        if (allCandidatesCount <= MAX_CANDIDATES_FOR_QUOTA) {
          quota = getRegionBandQuota(region, br.band, state);
        }
        quotaByBandKey.set(key, quota);
        return quota;
      }

      function candidatesInBand(br: { startRow: number; endRow: number }): number[] {
        const result: number[] = [];
        for (const cellId of region.cells) {
          const row = Math.floor(cellId / size);
          if (row < br.startRow || row > br.endRow) continue;
          if (state.cellStates[cellId] === CellState.Unknown) {
            result.push(cellId);
          }
        }
        return result;
      }

      // Try to find a band where we can deduce the quota
      // by knowing quotas of all other bands
      for (const targetBR of intersectingBandRanges) {
        // Early exit: Check if target band has any candidates
        const candidatesInTargetBand = candidatesInBand(targetBR);
        if (candidatesInTargetBand.length === 0) continue;

        const otherBands = intersectingBandRanges.filter(b => b !== targetBR);

        // Early exit: Need at least one other band
        if (otherBands.length === 0) continue;

        // Check if we know quotas for all other bands
        // (Simplified - full implementation would track deduced quotas)
        let knownQuotas = 0;
        let totalKnownQuota = 0;

        for (const br of otherBands) {
          if (br.candidatesInBandCount === 0) continue; // quota irrelevant for deduction

          const quota = quotaForBand(br);
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
        const targetBandQuota = remainingInRegion - totalKnownQuota;

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
              targetBand: targetBR.band.rows,
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

