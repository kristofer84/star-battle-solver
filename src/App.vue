<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import StarBattleBoard from './components/StarBattleBoard.vue';
import RegionPicker from './components/RegionPicker.vue';
import ModeToolbar from './components/ModeToolbar.vue';
import HintPanel from './components/HintPanel.vue';
import EntanglementViewer from './components/EntanglementViewer.vue';

// Build-time information (injected by Vite at build time)
const commitHash = __COMMIT_HASH__;
const buildTime = __BUILD_TIME__;

import {
  store,
  setMode,
  setSelectionMode,
  setSelectedRegion,
  handleCellClickEditor,
  handleCellClickPlay,
  applyHintToState,
  replacePuzzleFromImport,
  clearStarsAndCrosses,
  setShowRowColNumbers,
  setShowAreaLabels,
  undo,
  redo,
  canUndo,
  canRedo,
  clearLog,
  setShowLog,
  setShowDebugLog,
  clearConsoleLog,
  setRegionTheme,
  setTechniqueEnabled,
  enableAllTechniques,
  isTechniqueEnabled,
  addLogEntry,
  beginSolveRun,
  stopSolveRun,
  type RegionTheme,
} from './store/puzzleStore';
import { setupConsoleInterceptor } from './utils/consoleInterceptor';
import type { Coords, CellState } from './types/puzzle';
import type { TechniqueId } from './types/hints';
import { validateState, validateRegions, getRuleViolations, isPuzzleComplete } from './logic/validation';
import { findNextHint, techniquesInOrder } from './logic/techniques';

const importText = ref('');
const importError = ref<string | null>(null);
const logPanelRef = ref<HTMLElement | null>(null);
const debugLogPanelRef = ref<HTMLElement | null>(null);
const selectedPuzzle = ref<string>('');
const showEntanglementViewer = ref(false);
const selectedPatternId = ref<string | null>(null);
const showTechniqueManager = ref(false);

const showThinkingIndicator = computed(() => store.isThinking);

const regionThemeOptions: Array<{ value: RegionTheme; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'vibrant', label: 'Vibrant' },
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'forest', label: 'Forest' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'neon', label: 'Neon' },
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
];

const enabledTechniqueCount = computed(() => techniquesInOrder.length - store.disabledTechniques.length);

watch(selectedPuzzle, () => {
  loadPredefinedPuzzle();
});

// Predefined puzzles
const predefinedPuzzles = [
  {
    name: 'Puzzle 1',
    data: `0 0 0 1 1 1 2 2 3 3
0 0 0 1 1 1 2 2 3 3
4 4 0 0 1 2 2 2 2 3
4 0 0 0 1 2 2 3 2 3
4 0 5 0 1 7 7 3 3 3
4 0 5 1 1 7 3 3 9 3
4 5 5 5 1 7 3 8 9 3
4 4 5 5 5 5 5 8 9 9
4 4 6 6 6 5 5 8 9 9
6 6 6 5 5 5 5 8 9 9`
  },
  {
    name: 'Puzzle 2',
    data: `0 0 0 0 0 1 1 1 1 1
2 2 2 0 1 1 1 1 1 3
2 2 0 0 1 3 3 3 3 3
4 4 0 4 3 3 3 3 3 8
4 4 0 4 3 3 3 7 7 8
5 4 4 4 6 6 7 7 8 8
5 6 4 6 6 6 6 7 7 8
5 6 6 6 7 7 7 7 8 8
5 5 5 6 6 7 9 9 9 9
5 5 6 6 9 9 9 9 9 9`
  },
  {
    name: 'Maho Yokota',
    data: `0 0 0 0 0 0 0 0 1 1
0 2 2 2 2 2 1 1 1 1
2 2 3 4 4 4 1 1 5 5
2 2 3 4 4 4 5 5 5 5
2 6 3 3 3 4 4 4 5 5
7 6 3 3 3 3 3 4 5 5
7 6 6 6 3 4 4 4 5 9
7 6 6 6 3 3 3 4 8 9
7 6 7 6 8 8 8 8 8 9
7 7 7 8 8 9 9 9 9 9`
  },
  {
    name: 'Puzzle 4',
    data: `0 0 0 1 1 1 1 1 1 1
0 0 1 1 2 2 2 3 3 4
0 0 1 0 0 2 3 3 4 4
0 0 1 0 0 2 3 4 4 5
6 0 1 0 2 2 3 4 4 5
6 0 0 0 7 7 3 3 4 5
6 8 8 8 7 7 9 9 4 5
6 8 8 8 7 7 7 9 9 5
6 6 6 8 8 7 7 9 9 5
6 6 8 8 7 7 9 9 9 9`
  },
  {
    name: 'Puzzle 5',
    data: `0 0 0 1 1 1 1 1 1 1
0 2 0 0 1 1 1 1 3 3
0 2 0 1 1 3 3 3 3 3
0 2 0 2 2 3 4 4 4 3
5 2 2 2 3 3 4 4 6 7
5 2 2 2 3 4 4 4 6 7
5 2 8 8 8 4 4 4 6 7
5 2 9 9 8 4 4 4 6 7
5 9 9 9 8 8 6 6 6 7
5 9 8 8 8 8 6 6 6 6`
  },
  {
    name: 'Puzzle 6',
    data: `0 0 0 1 1 1 1 1 1 1
0 0 1 1 2 2 2 3 3 4
0 0 1 0 0 2 3 3 4 4
0 0 1 0 0 2 3 4 4 5
6 0 1 0 2 2 3 4 4 5
6 0 0 0 7 7 3 3 4 5
6 8 8 8 7 7 9 9 4 5
6 8 8 8 7 7 7 9 9 5
6 6 6 8 8 7 7 9 9 5
6 6 8 8 7 7 9 9 9 9`
  },
  {
    name: "Kris De Asis",
    data: `0 0 0 1 1 1 1 2 2 2
0 3 3 3 1 1 1 1 1 2
0 0 3 3 4 1 4 1 1 2
0 4 4 4 4 4 4 4 2 2
0 0 5 5 4 4 4 4 4 2
0 0 0 5 5 6 6 6 7 7
0 0 5 5 5 5 6 6 7 7
8 5 5 5 5 5 5 5 7 7
8 5 5 8 5 9 9 5 7 7
8 8 8 8 9 9 9 9 9 7`
  }
];

const violations = computed(() => getRuleViolations(store.puzzle));

function formatLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function formatTechniqueTooltip(testedTechniques: Array<{ technique: string; timeMs: number }>): string {
  if (!testedTechniques || testedTechniques.length === 0) {
    return '';
  }
  // Find the longest technique name for alignment
  const maxNameLength = Math.max(...testedTechniques.map(t => t.technique.length));

  return testedTechniques.map(t => {
    const paddedName = t.technique.padEnd(maxNameLength);
    return `${paddedName}  ${t.timeMs.toFixed(2).padStart(8)}ms`;
  }).join('\n');
}

function onCellClick(coords: Coords) {
  if (store.mode === 'editor') {
    handleCellClickEditor(coords);
  } else {
    handleCellClickPlay(coords);
  }
  store.issues = validateState(store.puzzle);
}

function onChangeMode(mode: 'editor' | 'play') {
  if (mode === 'play') {
    const regionIssues = validateRegions(store.puzzle.def);
    if (regionIssues.length) {
      // Stay in editor and surface issues.
      store.issues = regionIssues;
      return;
    }
  }
  setMode(mode);
}

function onChangeSelection(mode: 'region' | 'star' | 'cross' | 'erase') {
  setSelectionMode(mode);
}

function onSelectRegion(id: number) {
  setSelectedRegion(id);
}

function onChangeTheme(theme: RegionTheme) {
  setRegionTheme(theme);
}

function onPatternClick(patternId: string) {
  selectedPatternId.value = patternId;
  showEntanglementViewer.value = true;
}

async function requestHint() {
  const signal = beginSolveRun();
  // Set thinking state immediately so UI can update
  store.isThinking = true;
  store.currentTechnique = null;

  // Allow Vue to update the DOM
  await nextTick();
  if (signal.aborted) {
    store.isThinking = false;
    store.currentTechnique = null;
    return;
  }
  // Wait for browser to paint the spinner
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 100); // Give enough time for spinner to be visible
    });
  });
  if (signal.aborted) {
    store.isThinking = false;
    store.currentTechnique = null;
    return;
  }

  // Now call findNextHint (it will manage isThinking from here)
  const hint = await findNextHint(store.puzzle);
  store.currentHint = hint;
  if (!hint) {
    store.issues = signal.aborted
      ? ['Stopped.']
      : ['No further logical hint found with current techniques.'];
  } else {
    store.issues = [];
  }
}

function applyHint() {
  applyHintToState(store.currentHint);
  store.currentHint = null; // Clear hint after applying
  store.issues = validateState(store.puzzle);
}

async function trySolve() {
  if (store.mode !== 'play') return;
  const signal = beginSolveRun();
  store.isAutoSolving = true;

  const startTime = performance.now();
  const maxIterations = 500; // Safety limit
  let iteration = 0;
  let hintsApplied = 0;

  try {
    while (iteration < maxIterations) {
      if (signal.aborted) {
        const endTime = performance.now();
        const totalTimeMs = endTime - startTime;

        addLogEntry({
          timestamp: Date.now(),
          technique: 'Try Solve',
          timeMs: totalTimeMs,
          message: `Stopped: User cancelled. Applied ${hintsApplied} step${hintsApplied !== 1 ? 's' : ''} (${totalTimeMs.toFixed(2)}ms total)`,
          testedTechniques: [],
        });

        store.currentHint = null;
        store.issues = ['Stopped.'];
        return;
      }
    // Check if puzzle is already complete
    if (isPuzzleComplete(store.puzzle)) {
      const endTime = performance.now();
      const totalTimeMs = endTime - startTime;

      // Add summary log entry
      addLogEntry({
        timestamp: Date.now(),
        technique: 'Try Solve',
        timeMs: totalTimeMs,
        message: `Solved puzzle in ${hintsApplied} step${hintsApplied !== 1 ? 's' : ''} (${totalTimeMs.toFixed(2)}ms total)`,
        testedTechniques: [],
      });

      store.issues = [];
      store.currentHint = null;
      return;
    }

    // Find next hint
    const hint = await findNextHint(store.puzzle);

    if (!hint) {
      const endTime = performance.now();
      const totalTimeMs = endTime - startTime;

      // Add summary log entry
      addLogEntry({
        timestamp: Date.now(),
        technique: 'Try Solve',
        timeMs: totalTimeMs,
        message: `Stopped: No more hints found. Applied ${hintsApplied} step${hintsApplied !== 1 ? 's' : ''} (${totalTimeMs.toFixed(2)}ms total)`,
        testedTechniques: [],
      });

      store.currentHint = null;
      store.issues = signal.aborted
        ? ['Stopped.']
        : ['No further logical hint found with current techniques.'];
      return;
    }

    // Apply the hint immediately
    applyHintToState(hint);
    store.currentHint = null;
    store.issues = validateState(store.puzzle);
    hintsApplied++;

    // Check for basic constraint violations (error cells)
    const violations = getRuleViolations(store.puzzle);
    const hasViolations = violations.rows.size > 0 ||
      violations.cols.size > 0 ||
      violations.regions.size > 0 ||
      violations.adjacentCells.size > 0;

    if (hasViolations) {
      const endTime = performance.now();
      const totalTimeMs = endTime - startTime;

      // Add summary log entry
      addLogEntry({
        timestamp: Date.now(),
        technique: 'Try Solve',
        timeMs: totalTimeMs,
        message: `Stopped: Basic constraint violated (error cells detected). Applied ${hintsApplied} step${hintsApplied !== 1 ? 's' : ''} (${totalTimeMs.toFixed(2)}ms total)`,
        testedTechniques: [],
      });

      store.currentHint = null;
      return;
    }

    // Yield to allow UI to update (prefer rAF so the browser can paint).
    await new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    iteration++;
  }

  // Reached max iterations
  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  // Add summary log entry
  addLogEntry({
    timestamp: Date.now(),
    technique: 'Try Solve',
    timeMs: totalTimeMs,
    message: `Stopped: Reached maximum iterations (${maxIterations}). Applied ${hintsApplied} step${hintsApplied !== 1 ? 's' : ''} (${totalTimeMs.toFixed(2)}ms total)`,
    testedTechniques: [],
  });

  store.currentHint = null;
  store.issues = ['Reached maximum iterations. Puzzle may be unsolvable with current techniques.'];
  } finally {
    store.isAutoSolving = false;
  }
}

function stopSolve() {
  stopSolveRun();
}

function clearBoard() {
  clearStarsAndCrosses();
  store.issues = validateState(store.puzzle);
}

function onTechniqueToggle(technique: TechniqueId, event: Event) {
  const enabled = (event.target as HTMLInputElement).checked;
  setTechniqueEnabled(technique, enabled);
}

function onEnableAllTechniques() {
  enableAllTechniques();
}

function handleUndo() {
  undo();
  store.issues = validateState(store.puzzle);
}

function handleRedo() {
  redo();
  store.issues = validateState(store.puzzle);
}

function handleKeyDown(event: KeyboardEvent) {
  // Only handle shortcuts when in play mode and not typing in an input/textarea
  if (store.mode !== 'play') return;
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

  if (event.key.toLowerCase() === 'h') {
    event.preventDefault();
    requestHint();
  } else if (event.key.toLowerCase() === 'a') {
    event.preventDefault();
    applyHint();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  // Setup console interceptor to capture debug logs
  setupConsoleInterceptor();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

function parsePuzzleString(raw: string): { regions: number[][]; cells: CellState[][]; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { regions: [], cells: [], error: 'Paste a 10×10 grid first.' };
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length !== 10) {
    return { regions: [], cells: [], error: `Expected 10 rows, found ${lines.length}.` };
  }

  const regions: number[][] = [];
  const cells: CellState[][] = [];

  for (let r = 0; r < 10; r += 1) {
    const parts = lines[r].split(/\s+/).filter((p) => p.length > 0);
    if (parts.length !== 10) {
      return { regions: [], cells: [], error: `Row ${r + 1} has ${parts.length} entries, expected 10.` };
    }

    const regionRow: number[] = [];
    const cellRow: CellState[] = [];

    for (let c = 0; c < 10; c += 1) {
      const token = parts[c];
      const match = token.match(/^(\d+)([sxSX])?$/);
      if (!match) {
        return { regions: [], cells: [], error: `Invalid token "${token}" at row ${r + 1}, col ${c + 1}. Use e.g. "3", "3s", "3x".` };
      }
      let regionId = parseInt(match[1], 10);
      const mark = match[2];

      // Accept 0..9 input (0 -> A, 1 -> B, ..., 9 -> J)
      if (regionId < 0 || regionId > 9) {
        return { regions: [], cells: [], error: `Region id ${regionId} at row ${r + 1}, col ${c + 1} is out of range 0–9 (A–J).` };
      }

      regionRow.push(regionId);

      let cellState: CellState = 'empty';
      if (mark) {
        if (mark.toLowerCase() === 's') cellState = 'star';
        else if (mark.toLowerCase() === 'x') cellState = 'cross';
      }
      cellRow.push(cellState);
    }

    regions.push(regionRow);
    cells.push(cellRow);
  }

  return { regions, cells, error: null };
}

function applyImport() {
  importError.value = null;
  const result = parsePuzzleString(importText.value);
  if (result.error) {
    importError.value = result.error;
    return;
  }

  replacePuzzleFromImport(result.regions, result.cells);
  store.issues = validateRegions(store.puzzle.def);
}

function formatPuzzleString(): string {
  const rows: string[] = [];
  for (let r = 0; r < 10; r += 1) {
    const tokens: string[] = [];
    for (let c = 0; c < 10; c += 1) {
      let regionId = store.puzzle.def.regions[r][c];
      // Map region 10 to 0 for output
      if (regionId === 10) regionId = 0;

      const cellState = store.puzzle.cells[r][c];
      let token = String(regionId);
      if (cellState === 'star') {
        token += 's';
      } else if (cellState === 'cross') {
        token += 'x';
      }
      tokens.push(token);
    }
    rows.push(tokens.join(' '));
  }
  return rows.join('\n');
}

async function copyPuzzle() {
  try {
    const puzzleString = formatPuzzleString();
    await navigator.clipboard.writeText(puzzleString);
    // Optionally show a brief success message
    importError.value = null;
  } catch (err) {
    importError.value = 'Failed to copy puzzle to clipboard.';
  }
}

function loadPredefinedPuzzle() {
  if (!selectedPuzzle.value) return;

  const puzzle = predefinedPuzzles.find(p => p.name === selectedPuzzle.value);
  if (!puzzle) return;

  importError.value = null;
  importText.value = puzzle.data;
  const result = parsePuzzleString(importText.value);
  if (result.error) {
    importError.value = result.error;
    return;
  }

  replacePuzzleFromImport(result.regions, result.cells);
  store.issues = validateRegions(store.puzzle.def);
  // Clear selection after loading
  selectedPuzzle.value = '';
}

// Auto-scroll log to bottom when new entries are added
function scrollLogToBottom() {
  nextTick(() => {
    if (logPanelRef.value) {
      logPanelRef.value.scrollTop = logPanelRef.value.scrollHeight;
    }
  });
}

// Auto-scroll debug log to bottom when new entries are added
function scrollDebugLogToBottom() {
  nextTick(() => {
    if (debugLogPanelRef.value) {
      debugLogPanelRef.value.scrollTop = debugLogPanelRef.value.scrollHeight;
    }
  });
}

// Watch for changes to log entries and auto-scroll
watch(
  () => [store.logEntries.length, store.preservedLogEntries.length, store.showLog],
  () => {
    if (store.showLog) {
      scrollLogToBottom();
    }
  }
);

// Watch for changes to console log entries and auto-scroll
watch(
  () => [store.consoleLogEntries.length, store.showDebugLog],
  () => {
    if (store.showDebugLog) {
      scrollDebugLogToBottom();
    }
  }
);
</script>

<template>
  <div class="app-shell">
    <div class="card">
      <div class="card-header">
        <div>
          <div style="font-weight: 600">
            Star Battle 10×10 · 2★
          </div>
          <div class="subtle-text">
            Editor and board
          </div>
        </div>
        <div class="pill">
          10×10 · 2★
        </div>
      </div>

      <ModeToolbar :mode="store.mode" :selection-mode="store.selectionMode"
        :show-row-col-numbers="store.showRowColNumbers" :show-area-labels="store.showAreaLabels" :can-undo="canUndo()"
        :can-redo="canRedo()" :region-theme="store.regionTheme" :theme-options="regionThemeOptions"
        @change-mode="onChangeMode" @change-selection="onChangeSelection" @request-hint="requestHint"
        @apply-hint="applyHint" @try-solve="trySolve" @stop-solve="stopSolve" @clear="clearBoard"
        @toggle-row-col-numbers="() => setShowRowColNumbers(!store.showRowColNumbers)"
        @toggle-area-labels="() => setShowAreaLabels(!store.showAreaLabels)" @undo="handleUndo" @redo="handleRedo"
        @change-theme="onChangeTheme" />

      <div v-if="store.mode === 'editor'" class="editor-layout">
        <div class="editor-layout__board">
          <StarBattleBoard :state="store.puzzle" selection-mode="region" :selected-region-id="store.selectedRegionId"
            :hint-highlight="store.currentHint?.highlights ?? null" :result-cells="store.currentHint?.resultCells ?? []"
            :show-row-col-numbers="store.showRowColNumbers" :violations="violations" mode="editor"
            @cell-click="onCellClick" />
        </div>
        <div class="editor-layout__side">
          <RegionPicker :selected-id="store.selectedRegionId" @select-region="onSelectRegion" />
          <div class="issues-list" v-if="store.issues.length">
            <div>Issues</div>
            <ul>
              <li v-for="issue in store.issues" :key="issue">
                {{ issue }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div v-else style="margin-top: 0.6rem">
        <StarBattleBoard :state="store.puzzle" :selection-mode="store.selectionMode"
          :selected-region-id="store.selectedRegionId" :hint-highlight="store.currentHint?.highlights ?? null"
          :result-cells="store.currentHint?.resultCells ?? []" :show-row-col-numbers="store.showRowColNumbers"
          :show-area-labels="store.showAreaLabels || !!store.currentHint" :violations="violations" mode="play"
          @cell-click="onCellClick" />
        <div v-if="showThinkingIndicator" class="thinking-indicator">
          <div class="thinking-spinner"></div>
          <span>
            <template v-if="store.currentTechnique">Testing {{ store.currentTechnique }}...</template>
            <template v-else>Looking for hint...</template>
          </span>
        </div>
        <div v-if="isPuzzleComplete(store.puzzle)" class="completion-status">
          Puzzle complete
        </div>
        <div class="issues-list" v-else-if="store.issues.length">
          <div>Status</div>
          <ul>
            <li v-for="issue in store.issues" :key="issue">
              {{ issue }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="card">
      <HintPanel
        v-if="store.mode === 'play'"
        :hint="store.currentHint"
        :deductions="store.filteredDeductions"
        @pattern-click="onPatternClick"
      />

      <div class="toggle-stack" style="margin-top: 1rem">
        <div class="toggle-block">
          <button type="button" class="btn secondary toggle-button"
            @click="showEntanglementViewer = !showEntanglementViewer">
            <span class="material-symbols-outlined btn__icon" aria-hidden="true">auto_awesome_motion</span>
            <span class="btn__label">{{ showEntanglementViewer ? 'Hide' : 'Show' }} entanglement patterns</span>
          </button>
          <div v-if="showEntanglementViewer" class="panel-after-toggle panel-after-toggle--entanglement">
            <div class="embedded-card">
              <EntanglementViewer :selected-pattern-id="selectedPatternId"
                @pattern-selected="selectedPatternId = $event" />
            </div>
          </div>
        </div>

        <template v-if="store.mode === 'play'">
          <div class="toggle-block">
            <button type="button" class="btn secondary toggle-button" @click="setShowLog(!store.showLog)">
              <span class="material-symbols-outlined btn__icon" aria-hidden="true">list_alt</span>
              <span class="btn__label">{{ store.showLog ? 'Hide' : 'Show' }} log</span>
            </button>
            <div v-if="store.showLog" class="panel-after-toggle">
              <div class="panel-with-icon">
                <button v-if="store.logEntries.length > 0 || store.preservedLogEntries.length > 0" type="button"
                  class="panel-clear-icon" aria-label="Clear log" @click="clearLog()">
                  <span class="material-symbols-outlined" aria-hidden="true">delete_sweep</span>
                </button>
                <div ref="logPanelRef" class="log-panel">
                  <div v-if="store.preservedLogEntries.length > 0" class="log-section">
                    <div class="log-section-header">Preserved log</div>
                    <div class="log-entries">
                      <div v-for="(entry, index) in store.preservedLogEntries" :key="`preserved-${index}`"
                        class="log-entry">
                        <div class="log-header">
                          <span class="log-timestamp">{{ formatLogTimestamp(entry.timestamp) }}</span>
                          <span class="log-technique" :title="formatTechniqueTooltip(entry.testedTechniques || [])">
                            {{ entry.technique }}
                          </span>
                          <span class="log-time">
                            ({{ entry.timeMs.toFixed(2) }}ms
                            <span v-if="entry.testedTechniques && entry.testedTechniques.length > 0">
                              / {{entry.testedTechniques.reduce((sum, t) => sum + t.timeMs, 0).toFixed(2)}}ms total
                            </span>)
                          </span>
                        </div>
                        <div class="log-message">{{ entry.message }}</div>
                      </div>
                    </div>
                  </div>

                  <div v-if="store.preservedLogEntries.length > 0 && store.logEntries.length > 0" class="log-splitter">
                
                  </div>

                  <div v-if="store.logEntries.length > 0" class="log-section">
                    <div class="log-section-header">Current log</div>
                    <div class="log-entries">
                      <div v-for="(entry, index) in store.logEntries" :key="`current-${index}`" class="log-entry">
                        <div class="log-header">
                          <span class="log-timestamp">{{ formatLogTimestamp(entry.timestamp) }}</span>
                          <span class="log-technique" :title="formatTechniqueTooltip(entry.testedTechniques || [])">
                            {{ entry.technique }}
                          </span>
                          <span class="log-time">
                            ({{ entry.timeMs.toFixed(2) }}ms
                            <span v-if="entry.testedTechniques && entry.testedTechniques.length > 0">
                              / {{entry.testedTechniques.reduce((sum, t) => sum + t.timeMs, 0).toFixed(2)}}ms total
                            </span>)
                          </span>
                        </div>
                        <div class="log-message">{{ entry.message }}</div>
                      </div>
                    </div>
                  </div>

                  <div v-if="store.logEntries.length === 0 && store.preservedLogEntries.length === 0" class="log-empty">
                    No log entries yet. Request a hint to see solver progress.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="toggle-block">
            <button type="button" class="btn secondary toggle-button" @click="setShowDebugLog(!store.showDebugLog)">
              <span class="material-symbols-outlined btn__icon" aria-hidden="true">bug_report</span>
              <span class="btn__label">{{ store.showDebugLog ? 'Hide' : 'Show' }} debug log</span>
            </button>
            <div v-if="store.showDebugLog" class="panel-after-toggle">
              <div class="panel-with-icon">
                <button v-if="store.consoleLogEntries.length > 0" type="button" class="panel-clear-icon"
                  aria-label="Clear debug log" @click="clearConsoleLog()">
                  <span class="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
                <div ref="debugLogPanelRef" class="debug-log-panel">
                  <div class="debug-log-header">
                    <div class="log-section-header">Console Debug Log</div>
                    <div class="debug-log-count">{{ store.consoleLogEntries.length }} entries</div>
                  </div>
                  <div v-if="store.consoleLogEntries.length > 0" class="debug-log-entries">
                    <div v-for="(entry, index) in store.consoleLogEntries" :key="index"
                      :class="['debug-log-entry', `debug-log-entry--${entry.level}`]">
                      <div class="debug-log-header-line">
                        <span class="debug-log-timestamp">{{ formatLogTimestamp(entry.timestamp) }}</span>
                        <span :class="['debug-log-level', `debug-log-level--${entry.level}`]">
                          {{ entry.level.toUpperCase() }}
                        </span>
                      </div>
                      <div class="debug-log-content">{{ entry.formatted }}</div>
                    </div>
                  </div>
                  <div v-else class="log-empty">
                    No console logs yet. Console output will appear here.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="toggle-block">
            <button type="button" class="btn secondary toggle-button"
              @click="showTechniqueManager = !showTechniqueManager">
              <span class="material-symbols-outlined btn__icon" aria-hidden="true">extension</span>
              <span class="btn__label">{{ showTechniqueManager ? 'Hide' : 'Show' }} techniques ({{ enabledTechniqueCount
              }}/{{ techniquesInOrder.length }})</span>
            </button>
            <div v-if="showTechniqueManager" class="panel-after-toggle">
              <div class="technique-manager">
                <div class="technique-manager__header">
                  <div class="technique-manager__title">Choose which techniques the solver can use</div>
                  <div class="technique-manager__actions">
                    <button type="button" class="btn tertiary" @click="onEnableAllTechniques()">
                      <span class="material-symbols-outlined btn__icon" aria-hidden="true">select_all</span>
                      <span class="btn__label">Enable all</span>
                    </button>
                  </div>
                </div>
                <div class="technique-grid">
                  <label v-for="tech in techniquesInOrder" :key="tech.id" class="technique-toggle">
                    <input type="checkbox" :checked="isTechniqueEnabled(tech.id)"
                      @change="onTechniqueToggle(tech.id, $event)" />
                    <div class="technique-toggle__info">
                      <div class="technique-toggle__name">{{ tech.name }}</div>
                      <div class="technique-toggle__id">{{ tech.id }}</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-if="store.mode === 'editor'" class="editor-import-section">
        <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem">
          Load predefined puzzle
        </div>
        <select v-model="selectedPuzzle"
          style="width: 100%; padding: 0.3rem 0.5rem; border-radius: 0.5rem; border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(15, 23, 42, 0.9); color: #e5e7eb; font-size: 0.8rem; cursor: pointer; margin-bottom: 1rem;">
          <option value="">Select a puzzle...</option>
          <option v-for="puzzle in predefinedPuzzles" :key="puzzle.name" :value="puzzle.name">
            {{ puzzle.name }}
          </option>
        </select>
        <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem">
          Paste 10×10 puzzle
        </div>
        <div class="subtle-text" style="margin-bottom: 0.35rem">
          Space-separated entries, each like <code>3</code>, <code>3s</code> (star), or <code>3x</code> (cross).
          Use digits 0–9; 0 will be mapped to region 10.
        </div>
        <textarea v-model="importText" rows="10"
          style="width: 100%; resize: vertical; border-radius: 0.5rem; border: 1px solid rgba(148,163,184,0.5); background:#020617; color:#e5e7eb; padding:0.5rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:0.8rem;" />
        <div class="form-actions">
          <button type="button" class="btn secondary" @click="applyImport">
            <span class="material-symbols-outlined btn__icon" aria-hidden="true">file_upload</span>
            <span class="btn__label">Apply pasted puzzle</span>
          </button>
          <button type="button" class="btn secondary" @click="copyPuzzle">
            <span class="material-symbols-outlined btn__icon" aria-hidden="true">content_copy</span>
            <span class="btn__label">Copy current puzzle</span>
          </button>
          <span v-if="importError" style="color:#f97373; font-size:0.78rem;">
            {{ importError }}
          </span>
        </div>
      </div>

    </div>

    <div class="app-footer">
      <span class="footer-text">{{ commitHash }} · {{ buildTime }}</span>
    </div>
  </div>
</template>
