/**
 * Core data model types for schema-based solver
 * Maps to the schema specification types
 */

import type { Coords, PuzzleState } from '../../../types/puzzle';

/**
 * Cell ID: encodes row and column into a single number
 * cellId = row * size + col
 */
export type CellId = number;

/**
 * Cell state enum matching schema spec
 */
export enum CellState {
  Unknown = 0,
  Star = 1,
  Empty = 2,
}

/**
 * Convert from solver's CellState to schema CellState
 */
export function toSchemaCellState(state: 'empty' | 'star' | 'cross'): CellState {
  if (state === 'star') return CellState.Star;
  if (state === 'cross') return CellState.Empty;
  return CellState.Unknown;
}

/**
 * Convert from schema CellState to solver's CellState
 */
export function fromSchemaCellState(state: CellState): 'empty' | 'star' | 'cross' {
  if (state === CellState.Star) return 'star';
  if (state === CellState.Empty) return 'cross';
  return 'empty';
}

/**
 * Coordinate helper functions
 */
export function coordToCellId(coord: Coords, size: number): CellId {
  return coord.row * size + coord.col;
}

export function cellIdToCoord(cellId: CellId, size: number): Coords {
  return {
    row: Math.floor(cellId / size),
    col: cellId % size,
  };
}

export function isValidCell(cellId: CellId, size: number): boolean {
  const coord = cellIdToCoord(cellId, size);
  return coord.row >= 0 && coord.row < size && coord.col >= 0 && coord.col < size;
}

/**
 * Region definition
 */
export interface Region {
  id: number;
  name?: string;
  cells: CellId[];
  starsRequired: number;
}

/**
 * Row group
 */
export interface RowGroup {
  type: 'row';
  rowIndex: number;
  cells: CellId[];
  starsRequired: number;
}

/**
 * Column group
 */
export interface ColumnGroup {
  type: 'column';
  colIndex: number;
  cells: CellId[];
  starsRequired: number;
}

/**
 * Unified type for regions, rows, and columns
 */
export interface RegionRowCol {
  kind: 'region' | 'row' | 'col';
  id: number;
}

/**
 * Row band (contiguous subset of rows)
 */
export interface RowBand {
  type: 'rowBand';
  rows: number[]; // sorted list of row indices
  cells: CellId[] | undefined; // union of all cells in these rows
}

/**
 * Column band (contiguous subset of columns)
 */
export interface ColumnBand {
  type: 'colBand';
  cols: number[]; // sorted list of column indices
  cells: CellId[]; // union of all cells in these columns
}

/**
 * 2×2 block (cage)
 */
export interface Block2x2 {
  id: number;
  cells: CellId[]; // length 4
}

/**
 * Group kind type
 */
export type GroupKind =
  | 'row'
  | 'column'
  | 'region'
  | 'rowBand'
  | 'colBand'
  | 'block2x2';

/**
 * Generic group abstraction
 */
export interface Group {
  kind: GroupKind;
  id: string; // unique across all groups
  cells: CellId[];
  starsRequired?: number; // for row/column/region; optional for others
}

/**
 * Board state for schema system
 */
export interface BoardState {
  size: number;
  starsPerLine: number;
  starsPerRegion: number;
  cellStates: CellState[]; // length size*size, indexed by CellId
  regions: Region[];
  rows: RowGroup[];
  cols: ColumnGroup[];
  blocks2x2: Block2x2[];
}

