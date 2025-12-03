import type { Coords } from './puzzle';

export type TechniqueId =
  // 1. The basics
  | 'trivial-marks'
  | 'locked-line'
  | 'two-by-two'
  | 'cross-pressure'
  | 'shared-row-column'
  | 'one-by-n'
  | 'exclusion'
  | 'pressured-exclusion'
  | 'adjacent-exclusion'
  | 'simple-shapes'
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
  | 'entanglement';

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
}


