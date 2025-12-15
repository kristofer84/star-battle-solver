import type { Coords } from './puzzle';

export type TechniqueId =
  // 1. The basics
  | 'trivial-marks'
  | 'locked-line'
  | 'saturation'
  | 'adjacent-row-col'
  | 'two-by-two'
  | 'square-counting'
  | 'exact-fill'
  | 'simple-shapes'
  | 'cross-empty-patterns'
  | 'cross-pressure'
  | 'shared-row-column'
  | 'exclusion'
  | 'pressured-exclusion'
  | 'adjacent-exclusion'
  | 'forced-placement'
  // 2. Counting
  | 'undercounting'
  | 'overcounting'
  | 'finned-counts'
  | 'composite-shapes'
  | 'squeeze'
  | 'set-differentials'
  // 3. Uniqueness
  | 'by-a-thread'
  | 'at-sea'
  | 'by-a-thread-at-sea'
  // 4. Idiosyncrasies
  | 'kissing-ls'
  | 'the-m'
  | 'pressured-ts'
  | 'fish'
  | 'n-rooks'
  | 'entanglement'
  | 'entanglement-patterns'
  // 5. Schema-based (new)
  | 'schema-based';

export type HintKind = 'place-star' | 'place-cross';

export interface HintHighlight {
  cells?: Coords[];
  rows?: number[];
  cols?: number[];
  regions?: number[];
}

export interface Hint {
  id: string;
  kind: HintKind;
  technique: TechniqueId;
  resultCells: Coords[];
  explanation: string;
  highlights?: HintHighlight;
  details?: string[];
  patternId?: string; // For entanglement hints: the pattern ID that was matched
  // For schema-based hints: maps cell coordinates to their type when both stars and crosses are present
  schemaCellTypes?: Map<string, 'star' | 'cross'>; // key: "row,col"
}


