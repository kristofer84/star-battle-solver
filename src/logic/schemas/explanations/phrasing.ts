/**
 * Phrasing dictionary for consistent explanation language
 */

import { cellIdToCoord } from '../model/types';
import { idToLetter } from '../../helpers';

/**
 * Format cell coordinates as "C3", "F4", etc.
 */
export function formatCell(cellId: number, size: number): string {
  const coord = cellIdToCoord(cellId, size);
  const rowLabel = idToLetter(coord.row); // A, B, C...
  const colLabel = (coord.col + 1).toString(); // 1, 2, 3...
  return `${rowLabel}${colLabel}`;
}

/**
 * Format row band as "rows 3–5"
 */
export function formatRowBand(rows: number[]): string {
  if (rows.length === 0) return 'no rows';
  if (rows.length === 1) return `row ${rows[0] + 1}`;
  const start = rows[0] + 1;
  const end = rows[rows.length - 1] + 1;
  return `rows ${start}–${end}`;
}

/**
 * Format column band as "columns 2–4"
 */
export function formatColumnBand(cols: number[]): string {
  if (cols.length === 0) return 'no columns';
  if (cols.length === 1) return `column ${cols[0] + 1}`;
  const start = cols[0] + 1;
  const end = cols[cols.length - 1] + 1;
  return `columns ${start}–${end}`;
}

/**
 * Format region quota message
 */
export function idToLetterQuota(regionId: number, quota: number): string {
  return `region ${idToLetter(regionId)} must contain ${quota} star${quota !== 1 ? 's' : ''}`;
}

/**
 * Format 2×2 block reference
 */
export function formatBlock(blockId: number): string {
  return `2×2 block ${blockId}`;
}

/**
 * Format group reference
 */
export function formatGroup(kind: string, id: string): string {
  if (kind === 'row') {
    const rowIndex = parseInt(id.replace('row_', ''));
    return `row ${rowIndex + 1}`;
  }
  if (kind === 'column') {
    const colIndex = parseInt(id.replace('col_', ''));
    return `column ${colIndex + 1}`;
  }
  if (kind === 'region') {
    const regionId = parseInt(id.replace('region_', ''));
    return `region ${idToLetter(regionId)}`;
  }
  return `${kind} ${id}`;
}

