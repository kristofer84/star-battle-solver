/**
 * A1 – Row-Band vs Regions Star-Budget Squeeze
 * 
 * Given a band of rows, consider regions that intersect it.
 * Some regions are fully inside, some are partial.
 * By counting stars already committed, deduce how many stars
 * a specific partial region must place in the band.
 * 
 * Priority: 2 (after E1)
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { RowBand, Region } from '../model/types';
import { enumerateRowBands } from '../helpers/bandHelpers';
import {
  getRegionBandQuota,
} from '../helpers/bandHelpers';
import { MAX_CANDIDATES_FOR_QUOTA, type RegionBandInfo } from '../helpers/bandBudgetTypes';
import { CellState } from '../model/types';

/**
 * Build A1 explanation
 */
function buildA1Explanation(
  band: RowBand,
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
          kind: 'rowBand',
          rows: band.rows,
        },
        starsNeeded: band.rows.length * state.starsPerLine,
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
    schemaId: 'A1_rowBand_regionBudget',
    steps,
  };
}

/**
 * A1 Schema implementation
 */
export const A1Schema: Schema = {
  id: 'A1_rowBand_regionBudget',
  kind: 'bandBudget',
  priority: 2,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const size = state.size;

    // Enumerate all row bands
    const bands = enumerateRowBands(state);

    for (const band of bands) {
      const rows = band.rows;
      const rowsStarsNeeded = rows.length * state.starsPerLine;
      const startRow = rows[0];
      const endRow = rows[rows.length - 1];

      type A1RegionBandInfo = RegionBandInfo<{ quotaKnown: boolean }>;

      function getCandidateCellsInBand(region: Region): number[] {
        const result: number[] = [];
        for (const cellId of region.cells) {
          const row = Math.floor(cellId / size);
          if (row < startRow || row > endRow) continue;
          if (state.cellStates[cellId] === CellState.Unknown) {
            result.push(cellId);
          }
        }
        return result;
      }

      // Compute intersecting regions and per-region stats in one pass.
      const regionInfos: A1RegionBandInfo[] = [];
      for (const region of state.regions) {
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

          const row = Math.floor(cellId / size);
          const inBand = row >= startRow && row <= endRow;
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

        // Determine whether this region's band quota is "known" without doing any heavy work.
        // Only fall back to `getRegionBandQuota` when it has a chance to return something
        // stronger than the trivial lower bound (stars already in the band).
        let quota = starsInBand;
        let quotaKnown = false;

        if (isFullInside) {
          quota = region.starsRequired;
          quotaKnown = true;
        } else if (remainingInRegion <= 0) {
          quota = starsInBand;
          quotaKnown = true;
        } else if (candidatesInBandCount === allCandidatesCount) {
          quota = starsInBand + remainingInRegion;
          quotaKnown = true;
        } else {
          // `getRegionBandQuota` bails out when the region has too many candidates; in that
          // situation, calling it is pure overhead.
          if (allCandidatesCount <= MAX_CANDIDATES_FOR_QUOTA) {
            quota = getRegionBandQuota(region, band, state);
            quotaKnown = quota > starsInBand;
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
          quotaKnown,
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

      // If 2+ partial regions have unknown quotas, no target can satisfy the
      // "all other partial quotas are known" precondition.
      if (unknownPartialInfos.length > 1) {
        continue;
      }

      const allPartialHaveKnownQuotas = unknownPartialInfos.length === 0;
      const totalPartialQuota = allPartialHaveKnownQuotas
        ? partialInfos.reduce((sum, info) => sum + info.quota, 0)
        : 0;

      const targets = allPartialHaveKnownQuotas ? partialInfos : unknownPartialInfos;

      // For each valid target partial region
      for (const targetInfo of targets) {
        const target = targetInfo.region;
        const otherPartial = partialInfos
          .filter(info => info.region !== target)
          .map(info => info.region);

        const starsForcedOtherPartial = allPartialHaveKnownQuotas
          ? (totalPartialQuota - targetInfo.quota)
          : partialInfos.reduce((sum, info) => (info.region === target ? sum : sum + info.quota), 0);

        const starsForcedInR = starsForcedFullInside + starsForcedOtherPartial;
        const starsRemainingInR = rowsStarsNeeded - starsForcedInR;

        // Get candidates in target region within band
        const candInTargetBand = getCandidateCellsInBand(target);
        if (candInTargetBand.length === 0) continue;

        const remainingInTarget = targetInfo.remainingInRegion;
        if (remainingInTarget === 0) continue;

        // Check if we can make a deduction
        if (starsRemainingInR < 0 || starsRemainingInR > candInTargetBand.length) {
          // Inconsistent or not useful
          continue;
        }

        // If remaining equals candidate count or 0, we can force stars or empties
        if (starsRemainingInR === 0 || starsRemainingInR === candInTargetBand.length) {
          const deductions = candInTargetBand.map(cell => ({
            cell,
            type: (starsRemainingInR === 0 ? 'forceEmpty' : 'forceStar') as const,
          }));

          const explanation = buildA1Explanation(
            band,
            fullInside,
            otherPartial,
            target,
            starsRemainingInR,
            state
          );

          applications.push({
            schemaId: 'A1_rowBand_regionBudget',
            params: {
              rows,
              targetRegionId: target.id,
              starsInBand: starsRemainingInR,
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

