import { reactive } from 'vue';
import type { CellState, Coords, PuzzleState } from '../types/puzzle';
import type { TechniqueId } from '../types/hints';
import { createEmptyPuzzleDef, createEmptyPuzzleState, DEFAULT_STARS_PER_UNIT } from '../types/puzzle';
import type { Hint } from '../types/hints';

export type Mode = 'editor' | 'play';
export type SelectionMode = 'region' | 'star' | 'cross' | 'erase';

export interface TechniqueTest {
  technique: string;
  timeMs: number;
}

export interface LogEntry {
  timestamp: number;
  technique: string;
  timeMs: number;
  message: string;
  testedTechniques: TechniqueTest[];
}

export type RegionTheme = 'default' | 'pastel' | 'vibrant' | 'monochrome' | 'ocean' | 'forest' | 'sunset' | 'neon' | 'warm' | 'cool';

interface StoreState {
  mode: Mode;
  selectionMode: SelectionMode;
  selectedRegionId: number;
  puzzle: PuzzleState;
  currentHint: Hint | null;
  issues: string[];
  showRowColNumbers: boolean;
  showAreaLabels: boolean;
  history: PuzzleState[];
  historyIndex: number;
  logEntries: LogEntry[];
  preservedLogEntries: LogEntry[];
  preserveLog: boolean;
  showLog: boolean;
  regionTheme: RegionTheme;
  isThinking: boolean;
  currentTechnique: string | null;
  disabledTechniques: TechniqueId[];
}

const STORAGE_KEY = 'star-battle-10x10-v1';
const UI_STORAGE_KEY = 'star-battle-10x10-ui-v1';

interface StoredUIState {
  mode?: Mode;
  showRowColNumbers?: boolean;
  showAreaLabels?: boolean;
  showLog?: boolean;
  preserveLog?: boolean;
  regionTheme?: RegionTheme;
  disabledTechniques?: TechniqueId[];
}

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

function loadUIState(): StoredUIState {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredUIState;
  } catch {
    return {};
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

function saveUIState(state: StoredUIState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function currentUIState(): StoredUIState {
  return {
    mode: store.mode,
    showRowColNumbers: store.showRowColNumbers,
    showAreaLabels: store.showAreaLabels,
    showLog: store.showLog,
    preserveLog: store.preserveLog,
    regionTheme: store.regionTheme,
    disabledTechniques: store.disabledTechniques,
  };
}

function persistUIState(overrides?: Partial<StoredUIState>) {
  const base = currentUIState();
  saveUIState({ ...base, ...overrides });
}

function deepClonePuzzleState(state: PuzzleState): PuzzleState {
  return {
    def: {
      size: state.def.size,
      starsPerUnit: state.def.starsPerUnit,
      regions: state.def.regions.map(row => [...row]),
    },
    cells: state.cells.map(row => [...row]),
  };
}

const initialPuzzle = loadInitialPuzzle();
const uiState = loadUIState();

export const store = reactive<StoreState>({
  mode: uiState.mode || 'editor',
  selectionMode: 'region',
  selectedRegionId: 1,
  puzzle: initialPuzzle,
  currentHint: null,
  issues: [],
  showRowColNumbers: uiState.showRowColNumbers ?? false,
  showAreaLabels: uiState.showAreaLabels ?? false,
  history: [deepClonePuzzleState(initialPuzzle)],
  historyIndex: 0,
  logEntries: [],
  preservedLogEntries: [],
  preserveLog: uiState.preserveLog ?? false,
  showLog: uiState.showLog ?? false,
  regionTheme: uiState.regionTheme || 'default',
  isThinking: false,
  currentTechnique: null,
  disabledTechniques: uiState.disabledTechniques || [],
});

// Initialize theme on load
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-region-theme', store.regionTheme);
}

export function addLogEntry(entry: LogEntry) {
  store.logEntries.push(entry);
}

export function clearLog() {
  if (store.preserveLog) {
    store.preservedLogEntries = [...store.logEntries];
  } else {
    store.preservedLogEntries = [];
  }
  store.logEntries = [];
}

export function setPreserveLog(preserve: boolean) {
  store.preserveLog = preserve;
  if (!preserve) {
    store.preservedLogEntries = [];
  }
  persistUIState();
}

export function setShowLog(show: boolean) {
  store.showLog = show;
  persistUIState();
}

export function setMode(mode: Mode) {
  store.mode = mode;
  savePuzzleToStorage(store.puzzle);
  persistUIState();
}

export function setSelectionMode(mode: SelectionMode) {
  store.selectionMode = mode;
}

export function setSelectedRegion(id: number) {
  store.selectedRegionId = id;
}

export function setShowRowColNumbers(show: boolean) {
  store.showRowColNumbers = show;
  persistUIState();
}

export function setShowAreaLabels(show: boolean) {
  store.showAreaLabels = show;
  persistUIState();
}

export function setRegionTheme(theme: RegionTheme) {
  store.regionTheme = theme;
  persistUIState();
  // Update the root element's data attribute for CSS theme switching
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-region-theme', theme);
  }
}

export function setTechniqueEnabled(technique: TechniqueId, enabled: boolean) {
  const isDisabled = store.disabledTechniques.includes(technique);
  if (enabled && isDisabled) {
    store.disabledTechniques = store.disabledTechniques.filter((id) => id !== technique);
    persistUIState();
  } else if (!enabled && !isDisabled) {
    store.disabledTechniques = [...store.disabledTechniques, technique];
    persistUIState();
  }
}

export function enableAllTechniques() {
  if (store.disabledTechniques.length === 0) return;
  store.disabledTechniques = [];
  persistUIState();
}

export function isTechniqueEnabled(technique: TechniqueId): boolean {
  return !store.disabledTechniques.includes(technique);
}

const MAX_HISTORY_SIZE = 100;

function pushToHistory() {
  // Remove any future history if we're not at the end
  if (store.historyIndex < store.history.length - 1) {
    store.history = store.history.slice(0, store.historyIndex + 1);
  }
  
  // Add new state to history
  store.history.push(deepClonePuzzleState(store.puzzle));
  store.historyIndex = store.history.length - 1;
  
  // Limit history size
  if (store.history.length > MAX_HISTORY_SIZE) {
    store.history.shift();
    store.historyIndex--;
  }
}

export function undo() {
  if (store.historyIndex > 0) {
    store.historyIndex--;
    store.puzzle = deepClonePuzzleState(store.history[store.historyIndex]);
    savePuzzleToStorage(store.puzzle);
  }
}

export function redo() {
  if (store.historyIndex < store.history.length - 1) {
    store.historyIndex++;
    store.puzzle = deepClonePuzzleState(store.history[store.historyIndex]);
    savePuzzleToStorage(store.puzzle);
  }
}

export function canUndo(): boolean {
  return store.historyIndex > 0;
}

export function canRedo(): boolean {
  return store.historyIndex < store.history.length - 1;
}

export function handleCellClickEditor(coords: Coords) {
  const id = store.selectedRegionId;
  store.puzzle.def.regions[coords.row][coords.col] = id;
  savePuzzleToStorage(store.puzzle);
}

export function handleCellClickPlay(coords: Coords) {
  const current = store.puzzle.cells[coords.row][coords.col];
  let next: CellState;
  
  // Cycle: empty → cross → star → empty
  if (current === 'empty') {
    next = 'cross';
  } else if (current === 'cross') {
    next = 'star';
  } else if (current === 'star') {
    next = 'empty';
  } else {
    next = current; // fallback (shouldn't happen)
  }
  
  // Only push to history if state actually changed
  if (next !== current) {
    pushToHistory();
    store.puzzle.cells[coords.row][coords.col] = next;
    savePuzzleToStorage(store.puzzle);
  }
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
  
  pushToHistory();
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
  let hasChanges = false;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (store.puzzle.cells[r][c] === 'star' || store.puzzle.cells[r][c] === 'cross') {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) break;
  }
  
  if (hasChanges) {
    pushToHistory();
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (store.puzzle.cells[r][c] === 'star' || store.puzzle.cells[r][c] === 'cross') {
          store.puzzle.cells[r][c] = 'empty';
        }
      }
    }
    savePuzzleToStorage(store.puzzle);
  }
}

export function replacePuzzleFromImport(regions: number[][], cells: CellState[][]) {
  const size = regions.length;
  const newPuzzle: PuzzleState = {
    def: {
      size,
      starsPerUnit: DEFAULT_STARS_PER_UNIT,
      regions,
    },
    cells,
  };
  
  pushToHistory();
  store.puzzle = newPuzzle;
  store.mode = 'editor';
  store.selectionMode = 'region';
  store.selectedRegionId = 1;
  store.currentHint = null;
  store.issues = [];
  savePuzzleToStorage(store.puzzle);
}


