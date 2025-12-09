import type { TechniqueId } from './hints';
import type { Coords } from './puzzle';

/**
 * Base deduction properties shared by all deduction types
 */
export interface BaseDeduction {
  technique: TechniqueId;
  explanation?: string; // Optional explanation for debugging
}

/**
 * Cell-level deduction: specific cell must be star or cross
 */
export interface CellDeduction extends BaseDeduction {
  kind: 'cell';
  cell: Coords;
  type: 'forceStar' | 'forceEmpty';
}

/**
 * Block-level deduction: 2x2 block constraints
 */
export interface BlockDeduction extends BaseDeduction {
  kind: 'block';
  block: { bRow: number; bCol: number }; // Block coordinates (0-4 for 10x10 grid)
  starsRequired?: number; // Exact number of stars required (if known)
  minStars?: number; // Minimum stars (default 0)
  maxStars?: number; // Maximum stars (default Infinity)
}

/**
 * Area-level deduction: row/column/region constraints with bounds
 */
export interface AreaDeduction extends BaseDeduction {
  kind: 'area';
  areaType: 'row' | 'column' | 'region';
  areaId: number; // row index, column index, or region ID
  candidateCells: Coords[]; // Cells where star could be
  starsRequired?: number; // Exact number of stars required (if known)
  minStars?: number; // Minimum stars (default 0)
  maxStars?: number; // Maximum stars (default Infinity)
}

/**
 * Exclusive set deduction: exactly N of these cells must be stars
 */
export interface ExclusiveSetDeduction extends BaseDeduction {
  kind: 'exclusive-set';
  cells: Coords[];
  starsRequired: number; // Exact number of stars required
}

/**
 * Area relation deduction: linked constraints across multiple areas
 * Used for squeeze, set differentials, entanglement, fish patterns
 */
export interface AreaRelationDeduction extends BaseDeduction {
  kind: 'area-relation';
  areas: Array<{
    areaType: 'row' | 'column' | 'region';
    areaId: number;
    candidateCells: Coords[];
  }>;
  totalStars: number; // Sum of stars across all these areas
}

/**
 * Union type for all deduction types
 */
export type Deduction =
  | CellDeduction
  | BlockDeduction
  | AreaDeduction
  | ExclusiveSetDeduction
  | AreaRelationDeduction;

/**
 * Result from a technique evaluation
 * 
 * Techniques can return:
 * - A clear hint (100% certain) - optionally with deductions for main solver to combine
 * - Deductions only (partial information) - for main solver to analyze
 * - None (no information found)
 */
export type TechniqueResult =
  | { type: 'hint'; hint: import('./hints').Hint; deductions?: Deduction[] }
  | { type: 'deductions'; deductions: Deduction[] }
  | { type: 'none' };

