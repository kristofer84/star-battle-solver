/**
 * Schema system entry point
 */

export * from './types';
export * from './model/types';
export * from './model/state';
export * from './registry';
export * from './schemas/E1_candidateDeficit';
export * from './schemas/E2_partitionedCandidates';
export * from './schemas/A1_rowBandRegionBudget';
export * from './schemas/A2_colBandRegionBudget';
export * from './schemas/A3_regionRowBandPartition';
export * from './schemas/A4_regionColBandPartition';
export * from './schemas/C1_bandExactCages';
export * from './schemas/C2_cagesRegionQuota';
export * from './schemas/C3_internalCagePlacement';
export * from './schemas/C3_regionLocalCages';
export * from './schemas/C4_cageExclusion';
export * from './schemas/D1_rowColIntersection';
export * from './schemas/D2_regionBandIntersection';
export * from './schemas/F1_regionPairExclusion';
export * from './schemas/F2_exclusivityChains';
export * from './schemas/B1_exclusiveRegionsRowBand';
export * from './schemas/B2_exclusiveRegionsColBand';
export * from './schemas/B3_exclusiveRowsInRegion';
export * from './schemas/B4_exclusiveColsInRegion';

// Register schemas
import { registerSchema } from './registry';
import { E1Schema } from './schemas/E1_candidateDeficit';
import { E2Schema } from './schemas/E2_partitionedCandidates';
import { A1Schema } from './schemas/A1_rowBandRegionBudget';
import { A2Schema } from './schemas/A2_colBandRegionBudget';
import { A3Schema } from './schemas/A3_regionRowBandPartition';
import { A4Schema } from './schemas/A4_regionColBandPartition';
import { B1Schema } from './schemas/B1_exclusiveRegionsRowBand';
import { B2Schema } from './schemas/B2_exclusiveRegionsColBand';
import { B3Schema } from './schemas/B3_exclusiveRowsInRegion';
import { B4Schema } from './schemas/B4_exclusiveColsInRegion';
import { C1Schema } from './schemas/C1_bandExactCages';
import { C2Schema } from './schemas/C2_cagesRegionQuota';
import { C3Schema } from './schemas/C3_internalCagePlacement';
import { C3RegionLocalCagesSchema } from './schemas/C3_regionLocalCages';
import { C4Schema } from './schemas/C4_cageExclusion';
import { D1Schema } from './schemas/D1_rowColIntersection';
import { D2Schema } from './schemas/D2_regionBandIntersection';
import { F1Schema } from './schemas/F1_regionPairExclusion';
import { F2Schema } from './schemas/F2_exclusivityChains';

// Register all schemas in priority order
registerSchema(E1Schema);
registerSchema(E2Schema);
registerSchema(A1Schema);
registerSchema(A2Schema);
registerSchema(A3Schema);
registerSchema(A4Schema);
registerSchema(B1Schema);
registerSchema(B2Schema);
registerSchema(B3Schema);
registerSchema(B4Schema);
registerSchema(C1Schema);
registerSchema(C2Schema);
registerSchema(C3Schema);
registerSchema(C3RegionLocalCagesSchema);
registerSchema(C4Schema);
registerSchema(D1Schema);
registerSchema(D2Schema);
registerSchema(F1Schema);
registerSchema(F2Schema);

