/**
 * A4 – Region vs Column-Band Star Quota (Internal Partition)
 * 
 * Symmetric to A3 but with column bands.
 * 
 * Priority: 2
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { ColumnBand } from '../model/types';
import { enumerateColumnBands } from '../helpers/bandHelpers';
import { getRegionBandQuota } from '../helpers/bandHelpers';
import { MAX_CANDIDATES_FOR_QUOTA, MAX_TIME_MS, MAX_QUOTA_CALLS, type ColBandRange } from '../helpers/bandBudgetTypes';
import { CellState } from '../model/types';

/**
 * A4 Schema implementation
 */
export const A4Schema: Schema = {
  id: 'A4_region_colBandPartition',
  kind: 'bandBudget',
  priority: 2,
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const startTime = performance.now();
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const size = state.size;

    // Performance budget: limit processing time to prevent UI freezing
    let quotaCallCount = 0;

    // Pre-compute all bands once (expensive operation)
    const allBands = enumerateColumnBands(state);
    const bandRanges: ColBandRange[] = allBands.map(band => ({
      band,
      startCol: band.cols[0],
      endCol: band.cols[band.cols.length - 1],
    }));

    // For each region
    for (const region of state.regions) {
      // Early exit if we've exceeded time budget
      if (performance.now() - startTime > MAX_TIME_MS) {
        console.warn('Time budget exceeded');
        break;
      }
      
      // Early exit if we've hit quota call limit
      if (quotaCallCount >= MAX_QUOTA_CALLS) {
        console.warn('Quota call limit reached');
        break;
      }

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
          const col = cellId % size;
          if (col < br.startCol || col > br.endCol) continue;
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

      async function quotaForBand(br: { band: ColumnBand; startCol: number; endCol: number; starsInBand: number; candidatesInBandCount: number }): Promise<number> {
        const key = `${br.startCol}-${br.endCol}`;
        const cached = quotaByBandKey.get(key);
        if (cached !== undefined) {
          return cached;
        }

        let quota = br.starsInBand;
        if (allCandidatesCount <= MAX_CANDIDATES_FOR_QUOTA) {
          // Limit number of expensive quota calls to prevent locking
          if (quotaCallCount < MAX_QUOTA_CALLS && performance.now() - startTime <= MAX_TIME_MS) {
            quotaCallCount++;
            quota = await getRegionBandQuota(region, br.band, state);
          }
          // If limits exceeded, use trivial quota (starsInBand)
        }
        quotaByBandKey.set(key, quota);
        return quota;
      }

      function candidatesInBand(br: { startCol: number; endCol: number }): number[] {
        const result: number[] = [];
        for (const cellId of region.cells) {
          const col = cellId % size;
          if (col < br.startCol || col > br.endCol) continue;
          if (state.cellStates[cellId] === CellState.Unknown) {
            result.push(cellId);
          }
        }
        return result;
      }

      // Check time before target processing
      if (performance.now() - startTime > MAX_TIME_MS) {
        console.warn('Target processing timed out before targets');
        break;
      }

      // Try to find a band where we can deduce the quota
      for (const targetBR of intersectingBandRanges) {
        // Check time during target processing
        if (performance.now() - startTime > MAX_TIME_MS) {
          console.warn('Target processing timed out');
          break;
        }

        // Early exit: Check if target band has any candidates
        const candidatesInTargetBand = candidatesInBand(targetBR);
        if (candidatesInTargetBand.length === 0) continue;

        const otherBands = intersectingBandRanges.filter(b => b !== targetBR);

        // Early exit: Need at least one other band
        if (otherBands.length === 0) continue;

        let knownQuotas = 0;
        let totalKnownQuota = 0;

        for (const br of otherBands) {
          if (br.candidatesInBandCount === 0) continue;

          const quota = await quotaForBand(br);
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
                      band: { kind: 'colBand', cols: targetBR.band.cols },
                      quota: targetBandQuota,
                    },
                  },
                ],
              };

              applications.push({
                schemaId: 'A4_region_colBandPartition',
                params: {
                  regionId: region.id,
                  targetBand: targetBR.band.cols,
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

