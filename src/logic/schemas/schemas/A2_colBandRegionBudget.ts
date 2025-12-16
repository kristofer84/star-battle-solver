/**
 * A2 – Column-Band vs Regions Star-Budget Squeeze
 * 
 * Symmetric to A1 but with columns.
 * 
 * Priority: 2 (after E1, same as A1)
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { ColumnBand, Region } from '../model/types';
import { enumerateColumnBands } from '../helpers/bandHelpers';
import {
  getRegionBandQuota,
} from '../helpers/bandHelpers';
import { MAX_CANDIDATES_FOR_QUOTA, MAX_TIME_MS, MAX_QUOTA_CALLS, type RegionBandInfo } from '../helpers/bandBudgetTypes';
import { CellState } from '../model/types';

/**
 * Build A2 explanation (symmetric to A1)
 */
function buildA2Explanation(
  band: ColumnBand,
  fullInside: Region[],
  otherPartial: Region[],
  target: Region,
  starsRemaining: number,
  state: any
): ExplanationInstance {
  const steps = [
    {
      kind: 'countStarsInBand' as const,
      entities: {
        band: {
          kind: 'colBand',
          cols: band.cols,
        },
        starsNeeded: band.cols.length * state.starsPerLine,
      },
    },
  ];

  if (fullInside.length > 0) {
    steps.push({
      kind: 'countRegionQuota' as const,
      entities: {
        regions: fullInside.map(r => ({ kind: 'region', regionId: r.id })),
        totalStars: fullInside.reduce((sum, r) => sum + r.starsRequired, 0),
      },
    });
  }

  if (otherPartial.length > 0) {
    steps.push({
      kind: 'countRegionQuota' as const,
      entities: {
        regions: otherPartial.map(r => ({ kind: 'region', regionId: r.id })),
        note: 'known band quotas',
      },
    });
  }

  steps.push({
    kind: 'countRemainingStars' as const,
    entities: {
      remainingStars: starsRemaining,
      targetRegion: { kind: 'region', regionId: target.id },
    },
  });

  return {
    schemaId: 'A2_colBand_regionBudget',
    steps,
  };
}

/**
 * A2 Schema implementation
 */
export const A2Schema: Schema = {
  id: 'A2_colBand_regionBudget',
  kind: 'bandBudget',
  priority: 2,
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const startTime = performance.now();
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const size = state.size;

    // Performance budget: limit processing time to prevent UI freezing
    let quotaCallCount = 0;

    // Enumerate all column bands
    const bands = enumerateColumnBands(state);

    for (const band of bands) {
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

      const cols = band.cols;
      const colsStarsNeeded = cols.length * state.starsPerLine;
      const startCol = cols[0];
      const endCol = cols[cols.length - 1];

      function getCandidateCellsInBand(region: Region): number[] {
        const result: number[] = [];
        for (const cellId of region.cells) {
          const col = cellId % size;
          if (col < startCol || col > endCol) continue;
          if (state.cellStates[cellId] === CellState.Unknown) {
            result.push(cellId);
          }
        }
        return result;
      }

      // Early exit check before expensive region processing
      if (performance.now() - startTime > MAX_TIME_MS) {
        console.warn('Band processing timed out');
        break;
      }

      // Compute intersecting regions and per-region stats in one pass.
      const regionInfos: RegionBandInfo[] = [];
      for (const region of state.regions) {
        // Check time budget during region processing
        if (performance.now() - startTime > MAX_TIME_MS) {
          console.warn('Region processing timed out');
          break;
        }
        let anyInBand = false;
        let allInBand = true;
        let starsInBand = 0;
        let candidatesInBandCount = 0;
        let starsInRegion = 0;
        let allCandidatesCount = 0;

        for (const cellId of region.cells) {
          const cellState = state.cellStates[cellId];
          if (cellState === CellState.Star) {
            starsInRegion += 1;
          } else if (cellState === CellState.Unknown) {
            allCandidatesCount += 1;
          }

          const col = cellId % size;
          const inBand = col >= startCol && col <= endCol;
          if (inBand) {
            anyInBand = true;
            if (cellState === CellState.Star) {
              starsInBand += 1;
            } else if (cellState === CellState.Unknown) {
              candidatesInBandCount += 1;
            }
          } else {
            allInBand = false;
          }
        }

        if (!anyInBand) {
          continue;
        }

        const remainingInRegion = region.starsRequired - starsInRegion;
        const isFullInside = allInBand;

        // Determine the region's quota for this band.
        // Avoid calling `getRegionBandQuota` when it cannot return stronger than the trivial lower bound.
        let quota = starsInBand;
        if (isFullInside) {
          quota = region.starsRequired;
        } else if (remainingInRegion <= 0) {
          quota = starsInBand;
        } else if (candidatesInBandCount === allCandidatesCount) {
          quota = starsInBand + remainingInRegion;
        } else {
          // `getRegionBandQuota` bails out when the region has too many candidates; in that
          // situation, calling it is pure overhead.
          if (allCandidatesCount <= MAX_CANDIDATES_FOR_QUOTA) {
            // Limit number of expensive quota calls to prevent locking
            if (quotaCallCount >= MAX_QUOTA_CALLS) {
              // Skip this quota call to prevent excessive computation
            } else {
              quotaCallCount++;
              quota = await getRegionBandQuota(region, band, state);
              
              // Check time after expensive quota call
              if (performance.now() - startTime > MAX_TIME_MS) {
                console.warn('Quota call timed out');
                break;
              }
            }
          }
        }

        regionInfos.push({
          region,
          isFullInside,
          starsInBand,
          candidatesInBandCount,
          allCandidatesCount,
          starsInRegion,
          remainingInRegion,
          quota,
        });
      }

      const fullInsideInfos = regionInfos.filter(info => info.isFullInside);
      const partialInfos = regionInfos.filter(info => !info.isFullInside);
      if (partialInfos.length === 0) {
        continue;
      }

      const fullInside = fullInsideInfos.map(info => info.region);
      const starsForcedFullInside = fullInsideInfos.reduce(
        (sum, info) => sum + info.region.starsRequired,
        0
      );

      const unknownPartialInfos = partialInfos.filter(info => {
        const region = info.region;
        const starsInBand = info.starsInBand;
        const remainingStars = region.starsRequired - info.starsInRegion;
        const isKnown =
          remainingStars === 0 ||
          info.candidatesInBandCount === info.allCandidatesCount ||
          info.quota === region.starsRequired ||
          info.quota > starsInBand;
        return !isKnown;
      });

      // Same rule as A1: only proceed when all-but-at-most-one partial region have known quotas.
      if (unknownPartialInfos.length > 1) {
        continue;
      }

      const allPartialHaveKnownQuotas = unknownPartialInfos.length === 0;
      const totalPartialQuota = allPartialHaveKnownQuotas
        ? partialInfos.reduce((sum, info) => sum + info.quota, 0)
        : 0;

      const targets = allPartialHaveKnownQuotas ? partialInfos : unknownPartialInfos;

      // Check time before target processing
      if (performance.now() - startTime > MAX_TIME_MS) {
        console.warn('Target processing timed out before targets');
        break;
      }

      // For each target partial region
      for (const targetInfo of targets) {
        // Check time during target processing
        if (performance.now() - startTime > MAX_TIME_MS) {
          console.warn('Target processing timed out');
          break;
        }
        const target = targetInfo.region;
        const otherPartial = partialInfos
          .filter(info => info.region !== target)
          .map(info => info.region);

        const starsForcedOtherPartial = allPartialHaveKnownQuotas
          ? (totalPartialQuota - targetInfo.quota)
          : partialInfos.reduce((sum, info) => (info.region === target ? sum : sum + info.quota), 0);

        const starsForcedInC = starsForcedFullInside + starsForcedOtherPartial;
        const starsRemainingInC = colsStarsNeeded - starsForcedInC;

        // Get candidates in target region within band
        const candInTargetBand = getCandidateCellsInBand(target);
        if (candInTargetBand.length === 0) continue;

        if (targetInfo.remainingInRegion === 0) continue;

        // Check if we can make a deduction
        if (starsRemainingInC < 0 || starsRemainingInC > candInTargetBand.length) {
          continue;
        }

        // If remaining equals candidate count or 0, we can force stars or empties
        if (starsRemainingInC === 0 || starsRemainingInC === candInTargetBand.length) {
          const deductions = candInTargetBand.map(cell => ({
            cell,
            type: (starsRemainingInC === 0 ? 'forceEmpty' : 'forceStar') as const,
          }));

          const explanation = buildA2Explanation(
            band,
            fullInside,
            otherPartial,
            target,
            starsRemainingInC,
            state
          );

          applications.push({
            schemaId: 'A2_colBand_regionBudget',
            params: {
              cols,
              targetRegionId: target.id,
              starsInBand: starsRemainingInC,
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

