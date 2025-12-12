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
export * from './schemas/D3_regionBandSqueeze';
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
import { D3RegionBandSqueezeSchema } from './schemas/D3_regionBandSqueeze';
import { F1Schema } from './schemas/F1_regionPairExclusion';
import { F2Schema } from './schemas/F2_exclusivityChains';


let initialized = false;

export function initSchemas() {
    if (initialized) return;
    initialized = true;

    const start = performance.now();
    // Register all schemas in priority order
    registerSchema(E1Schema);
    console.log('[DEBUG] E1Schema registered', performance.now() - start)
    registerSchema(E2Schema);
    console.log('[DEBUG] E2Schema registered', performance.now() - start)
    registerSchema(A1Schema);
    console.log('[DEBUG] A1Schema registered', performance.now() - start)
    registerSchema(A2Schema);
    console.log('[DEBUG] A2Schema registered', performance.now() - start)
    registerSchema(A3Schema);
    console.log('[DEBUG] A3Schema registered', performance.now() - start)
    registerSchema(A4Schema);
    console.log('[DEBUG] A4Schema registered', performance.now() - start)
    registerSchema(B1Schema);
    console.log('[DEBUG] B1Schema registered', performance.now() - start)
    registerSchema(B2Schema);
    console.log('[DEBUG] B2Schema registered', performance.now() - start)
    registerSchema(B3Schema);
    console.log('[DEBUG] B3Schema registered', performance.now() - start)
    registerSchema(B4Schema);
    console.log('[DEBUG] B4Schema registered', performance.now() - start)
    registerSchema(C1Schema);
    console.log('[DEBUG] C1Schema registered', performance.now() - start)
    registerSchema(D3RegionBandSqueezeSchema);
    console.log('[DEBUG] D3RegionBandSqueezeSchema registered', performance.now() - start)
    registerSchema(C2Schema);
    console.log('[DEBUG] C2Schema registered', performance.now() - start)
    registerSchema(C3Schema);
    console.log('[DEBUG] C3Schema registered', performance.now() - start)
    registerSchema(C3RegionLocalCagesSchema);
    console.log('[DEBUG] C3RegionLocalCagesSchema registered', performance.now() - start)
    registerSchema(C4Schema);
    console.log('[DEBUG] C4Schema registered', performance.now() - start)
    registerSchema(D1Schema);
    console.log('[DEBUG] D1Schema registered', performance.now() - start)
    registerSchema(D2Schema);
    console.log('[DEBUG] D2Schema registered', performance.now() - start)
    registerSchema(F1Schema);
    console.log('[DEBUG] F1Schema registered', performance.now() - start)
    registerSchema(F2Schema);
    console.log('[DEBUG] F2Schema registered', performance.now() - start)
}