/**
 * Pattern loader for schema-based patterns
 * Loads pattern files from src/specs/patterns/
 */

import { patternFiles } from '../../specs/patterns';
import type { BoardState } from '../schemas/model/types';

/**
 * Pattern file structure
 */
export interface PatternFile {
  board_size: number;
  stars_per_row: number;
  stars_per_column: number;
  family_id: string;
  patterns: Pattern[];
}

/**
 * Pattern structure
 */
export interface Pattern {
  id: string;
  window_width: number;
  window_height: number;
  data: Record<string, any>;
  deductions: {
    type: 'forceStar' | 'forceEmpty';
    relative_cell_ids: number[];
  }[];
}

/**
 * Loaded pattern with metadata
 */
export interface LoadedPattern extends Pattern {
  familyId: string;
  boardSize: number;
  starsPerRow: number;
  starsPerColumn: number;
}

/**
 * Load all pattern files
 */
export function loadPatterns(): LoadedPattern[] {
  const loaded: LoadedPattern[] = [];

  for (const { id, data } of patternFiles) {
    if (!data || typeof data !== 'object') continue;

    const file = data as PatternFile;

    if (!Array.isArray(file.patterns)) continue;

    for (const pattern of file.patterns) {
      loaded.push({
        ...pattern,
        familyId: file.family_id,
        boardSize: file.board_size,
        starsPerRow: file.stars_per_row,
        starsPerColumn: file.stars_per_column,
      });
    }
  }

  return loaded;
}

/**
 * Filter patterns by puzzle parameters
 */
export function filterPatternsByPuzzle(
  patterns: LoadedPattern[],
  boardSize: number,
  starsPerUnit: number
): LoadedPattern[] {
  return patterns.filter((pattern) => {
    if (pattern.boardSize !== boardSize) return false;
    if (pattern.starsPerRow !== starsPerUnit) return false;
    if (pattern.starsPerColumn !== starsPerUnit) return false;
    return true;
  });
}

/**
 * Get patterns by family ID
 */
export function getPatternsByFamily(
  patterns: LoadedPattern[],
  familyId: string
): LoadedPattern[] {
  return patterns.filter((p) => p.familyId === familyId);
}

