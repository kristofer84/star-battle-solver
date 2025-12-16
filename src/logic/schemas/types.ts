/**
 * Schema framework types
 */

import type { BoardState, CellId } from './model/types';

/**
 * Deduction type
 */
export type DeductionType = 'forceStar' | 'forceEmpty';

/**
 * Deduction: a forced cell assignment
 */
export interface Deduction {
  cell: CellId;
  type: DeductionType;
}

/**
 * Explanation step kind
 */
export type ExplanationStepKind =
  | 'countStarsInBand'
  | 'countRegionQuota'
  | 'countRemainingStars'
  | 'identifyCandidateBlocks'
  | 'applyPigeonhole'
  | 'fixRegionBandQuota'
  | 'assignCageStars'
  | 'eliminateOtherRegionCells';

/**
 * Explanation step
 */
export interface ExplanationStep {
  kind: ExplanationStepKind;
  entities: Record<string, any>; // References to groups, bands, regions, blocks, cells
}

/**
 * Explanation instance
 */
export interface ExplanationInstance {
  schemaId: string;
  steps: ExplanationStep[];
}

/**
 * Schema application: result of applying a schema
 */
export interface SchemaApplication {
  schemaId: string;
  params: Record<string, any>; // concrete parameter values
  deductions: Deduction[];
  explanation: ExplanationInstance;
}

/**
 * Schema context
 */
export interface SchemaContext {
  state: BoardState;
  // Additional indexes and precomputed maps can go here
}

/**
 * Schema kind
 */
export type SchemaKind =
  | 'bandBudget'
  | 'exclusiveArea'
  | 'cage2x2'
  | 'mixed'
  | 'core'
  | 'multiRegion';

/**
 * Schema interface
 */
export interface Schema {
  id: string;
  kind: SchemaKind;
  priority: number; // lower = higher priority
  apply(ctx: SchemaContext): Promise<SchemaApplication[]>;
}

