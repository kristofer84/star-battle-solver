import type { ColumnBand, Region, RowBand } from '../model/types';

/**
 * Keep in sync with `getRegionBandQuota()` cutoff in `bandHelpers.ts`.
 * If a region has more than this many candidates, quota computation bails out
 * to the trivial lower bound (stars already in the band).
 */
export const MAX_CANDIDATES_FOR_QUOTA = 16;

export type RowBandRange = {
  band: RowBand;
  startRow: number;
  endRow: number;
};

export type ColBandRange = {
  band: ColumnBand;
  startCol: number;
  endCol: number;
};

export type BaseRegionBandInfo = {
  region: Region;
  isFullInside: boolean;
  starsInBand: number;
  candidatesInBandCount: number;
  allCandidatesCount: number;
  starsInRegion: number;
  remainingInRegion: number;
  quota: number;
};

export type RegionBandInfo<TExtra extends object = Record<string, never>> =
  BaseRegionBandInfo & TExtra;

