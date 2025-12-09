/**
 * C1 – Exact-Match 2×2 Cages in a Band
 * 
 * If number of valid 2×2 blocks equals remaining stars in band,
 * each block must contain exactly one star.
 * 
 * Priority: 4
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import { enumerateBands } from '../helpers/bandHelpers';
import { computeRemainingStarsInBand } from '../helpers/bandHelpers';
import { getValidBlocksInBand } from '../helpers/blockHelpers';
import { findCagePackings, type CageBlock } from '../helpers/blockPacking';

/**
 * C1 Schema implementation
 */
export const C1Schema: Schema = {
  id: 'C1_band_exactCages',
  kind: 'cage2x2',
  priority: 4,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    // Enumerate all bands (row and column)
    const bands = enumerateBands(state);

    for (const band of bands) {
      const remaining = computeRemainingStarsInBand(band, state);
      if (remaining <= 0) continue;

      // Get all valid blocks in the band
      const allBlocks = getValidBlocksInBand(band, state);
      
      // Convert to CageBlock format
      const cageBlocks: CageBlock[] = allBlocks.map(block => ({
        id: block.id,
        cells: block.cells,
      }));

      // Use exact-cover packing to find all ways to pack exactly 'remaining' blocks
      const packing = findCagePackings(cageBlocks, {
        band: {
          type: band.type === 'rowBand' ? 'rowBand' : 'colBand',
          rows: band.type === 'rowBand' ? band.rows : undefined,
          cols: band.type === 'colBand' ? band.cols : undefined,
          cells: band.cells,
        },
        targetBlockCount: remaining,
      });

      // C1 condition: there must be at least one solution with exactly 'remaining' blocks
      // This means we can pack exactly 'remaining' non-overlapping blocks
      if (packing.solutions.length === 0) continue;

      // Use the first solution for reporting (all solutions have the same block count)
      const representativeSolution = packing.solutions[0];
      const nonOverlappingBlocks = representativeSolution.blocks;

      // C1 condition met: exactly as many blocks as remaining stars
      // Each block must contain exactly one star
      // This is meta-information (no direct cell deductions, but sets up for C2)
      
      // Pre-filter: Skip if all cells in blocks are already filled (no unknown cells)
      // This prevents generating applications that will be filtered out
      const hasUnknownCells = nonOverlappingBlocks.some(block => 
        block.cells.some(cellId => state.cellStates[cellId] === 0) // CellState.Unknown
      );
      
      if (!hasUnknownCells) continue; // Skip if all cells are already filled

      const explanation: ExplanationInstance = {
        schemaId: 'C1_band_exactCages',
        steps: [
          {
            kind: 'countStarsInBand',
            entities: {
              band: band.type === 'rowBand'
                ? { kind: 'rowBand', rows: band.rows }
                : { kind: 'colBand', cols: band.cols },
              remainingStars: remaining,
            },
          },
          {
            kind: 'identifyCandidateBlocks',
            entities: {
              blocks: nonOverlappingBlocks.map(b => ({ kind: 'block2x2', blockId: b.id })),
              blockCount: nonOverlappingBlocks.length,
              solutionCount: packing.solutions.length,
            },
          },
          {
            kind: 'applyPigeonhole',
            entities: {
              note: 'Each block must contain exactly one star',
            },
          },
        ],
      };

      applications.push({
        schemaId: 'C1_band_exactCages',
        params: {
          bandKind: band.type,
          rows: band.type === 'rowBand' ? band.rows : undefined,
          cols: band.type === 'colBand' ? band.cols : undefined,
          remainingStars: remaining,
          blocks: nonOverlappingBlocks.map(b => b.id),
          solutionCount: packing.solutions.length,
        },
        deductions: [], // C1 alone does not force specific cells
        explanation,
      });
    }

    return applications;
  },
};

