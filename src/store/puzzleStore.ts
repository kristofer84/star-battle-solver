import { reactive } from 'vue';
import type { CellState, Coords, PuzzleState } from '../types/puzzle';
import { createEmptyPuzzleDef, createEmptyPuzzleState, DEFAULT_STARS_PER_UNIT } from '../types/puzzle';
import type { Hint } from '../types/hints';

export type Mode = 'editor' | 'play';
export type SelectionMode = 'region' | 'star' | 'cross' | 'erase';

interface StoreState {
  mode: Mode;
  selectionMode: SelectionMode;
  selectedRegionId: number;
  puzzle: PuzzleState;
  currentHint: Hint | null;
  issues: string[];
  showRowColNumbers: boolean;
}

const STORAGE_KEY = 'star-battle-10x10-v1';

function loadInitialPuzzle(): PuzzleState {
  if (typeof window === 'undefined') {
    return createEmptyPuzzleState(createEmptyPuzzleDef());
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyPuzzleState(createEmptyPuzzleDef());
    const parsed = JSON.parse(raw) as { puzzle?: PuzzleState };
    if (!parsed?.puzzle) return createEmptyPuzzleState(createEmptyPuzzleDef());
    return parsed.puzzle;
  } catch {
    return createEmptyPuzzleState(createEmptyPuzzleDef());
  }
}

function savePuzzleToStorage(puzzle: PuzzleState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        puzzle,
      }),
    );
  } catch {
    // ignore storage errors
  }
}

export const store = reactive<StoreState>({
  mode: 'editor',
  selectionMode: 'region',
  selectedRegionId: 1,
  puzzle: loadInitialPuzzle(),
  currentHint: null,
  issues: [],
  showRowColNumbers: false,
});

export function setMode(mode: Mode) {
  store.mode = mode;
  savePuzzleToStorage(store.puzzle);
}

export function setSelectionMode(mode: SelectionMode) {
  store.selectionMode = mode;
}

export function setSelectedRegion(id: number) {
  store.selectedRegionId = id;
}

export function setShowRowColNumbers(show: boolean) {
  store.showRowColNumbers = show;
}

export function handleCellClickEditor(coords: Coords) {
  const id = store.selectedRegionId;
  store.puzzle.def.regions[coords.row][coords.col] = id;
  savePuzzleToStorage(store.puzzle);
}

export function handleCellClickPlay(coords: Coords) {
  const current = store.puzzle.cells[coords.row][coords.col];
  let next: CellState = current;
  if (store.selectionMode === 'star') {
    next = current === 'star' ? 'empty' : 'star';
  } else if (store.selectionMode === 'cross') {
    next = current === 'cross' ? 'empty' : 'cross';
  } else if (store.selectionMode === 'erase') {
    next = 'empty';
  }
  store.puzzle.cells[coords.row][coords.col] = next;
  savePuzzleToStorage(store.puzzle);
}

export function applyHintToState(hint: Hint | null) {
  if (!hint) return;
  // Skip if all cells are already marked correctly
  let allAlreadyMarked = true;
  for (const c of hint.resultCells) {
    const current = store.puzzle.cells[c.row][c.col];
    const target = hint.kind === 'place-cross' ? 'cross' : 'star';
    if (current !== target) {
      allAlreadyMarked = false;
      break;
    }
  }
  if (allAlreadyMarked) return; // Nothing to do
  
  for (const c of hint.resultCells) {
    if (hint.kind === 'place-cross') {
      store.puzzle.cells[c.row][c.col] = 'cross';
    } else if (hint.kind === 'place-star') {
      store.puzzle.cells[c.row][c.col] = 'star';
    }
  }
  savePuzzleToStorage(store.puzzle);
}

export function clearStarsAndCrosses() {
  const size = store.puzzle.def.size;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (store.puzzle.cells[r][c] === 'star' || store.puzzle.cells[r][c] === 'cross') {
        store.puzzle.cells[r][c] = 'empty';
      }
    }
  }
  savePuzzleToStorage(store.puzzle);
}

export function replacePuzzleFromImport(regions: number[][], cells: CellState[][]) {
  const size = regions.length;
  store.puzzle = {
    def: {
      size,
      starsPerUnit: DEFAULT_STARS_PER_UNIT,
      regions,
    },
    cells,
  };
  store.mode = 'editor';
  store.selectionMode = 'region';
  store.selectedRegionId = 1;
  store.currentHint = null;
  store.issues = [];
  savePuzzleToStorage(store.puzzle);
}


