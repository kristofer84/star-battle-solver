<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import StarBattleBoard from './components/StarBattleBoard.vue';
import RegionPicker from './components/RegionPicker.vue';
import ModeToolbar from './components/ModeToolbar.vue';
import HintPanel from './components/HintPanel.vue';

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
} from './store/puzzleStore';
import type { Coords, CellState } from './types/puzzle';
import { validateState, validateRegions } from './logic/validation';
import { findNextHint } from './logic/techniques';

const importText = ref('');
const importError = ref<string | null>(null);

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

function requestHint() {
  const hint = findNextHint(store.puzzle);
  store.currentHint = hint;
  if (!hint) {
    store.issues = ['No further logical hint found with current techniques.'];
  } else {
    store.issues = [];
  }
}

function applyHint() {
  applyHintToState(store.currentHint);
  store.currentHint = null; // Clear hint after applying
  store.issues = validateState(store.puzzle);
}

function clearBoard() {
  clearStarsAndCrosses();
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
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

function applyImport() {
  importError.value = null;
  const raw = importText.value.trim();
  if (!raw) {
    importError.value = 'Paste a 10×10 grid first.';
    return;
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length !== 10) {
    importError.value = `Expected 10 rows, found ${lines.length}.`;
    return;
  }

  const regions: number[][] = [];
  const cells: CellState[][] = [];

  for (let r = 0; r < 10; r += 1) {
    const parts = lines[r].split(/\s+/).filter((p) => p.length > 0);
    if (parts.length !== 10) {
      importError.value = `Row ${r + 1} has ${parts.length} entries, expected 10.`;
      return;
    }

    const regionRow: number[] = [];
    const cellRow: CellState[] = [];

    for (let c = 0; c < 10; c += 1) {
      const token = parts[c];
      const match = token.match(/^(\d+)([sxSX])?$/);
      if (!match) {
        importError.value = `Invalid token "${token}" at row ${r + 1}, col ${c + 1}. Use e.g. "3", "3s", "3x".`;
        return;
      }
      let regionId = parseInt(match[1], 10);
      const mark = match[2];

      // Allow 0..9 input, mapping 0 -> 10 for convenience.
      if (regionId === 0) regionId = 10;
      if (regionId < 1 || regionId > 10) {
        importError.value = `Region id ${regionId} at row ${r + 1}, col ${c + 1} is out of range 1–10.`;
        return;
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

  replacePuzzleFromImport(regions, cells);
  store.issues = validateRegions(store.puzzle.def);
}
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

      <ModeToolbar
        :mode="store.mode"
        :selection-mode="store.selectionMode"
        :show-row-col-numbers="store.showRowColNumbers"
        @change-mode="onChangeMode"
        @change-selection="onChangeSelection"
        @request-hint="requestHint"
        @apply-hint="applyHint"
        @clear="clearBoard"
        @toggle-row-col-numbers="() => setShowRowColNumbers(!store.showRowColNumbers)"
      />

      <div v-if="store.mode === 'editor'" style="margin-top: 0.6rem; display: flex; gap: 1rem">
        <div style="flex: 3">
          <StarBattleBoard
            :state="store.puzzle"
            selection-mode="region"
            :selected-region-id="store.selectedRegionId"
            :hint-highlight="store.currentHint?.highlights ?? null"
            :show-row-col-numbers="store.showRowColNumbers"
            mode="editor"
            @cell-click="onCellClick"
          />
        </div>
        <div style="flex: 2">
          <RegionPicker
            :selected-id="store.selectedRegionId"
            @select-region="onSelectRegion"
          />
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
        <StarBattleBoard
          :state="store.puzzle"
          :selection-mode="store.selectionMode"
          :selected-region-id="store.selectedRegionId"
          :hint-highlight="store.currentHint?.highlights ?? null"
          :show-row-col-numbers="store.showRowColNumbers"
          mode="play"
          @cell-click="onCellClick"
        />
        <div class="issues-list" v-if="store.issues.length">
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
      <HintPanel :hint="store.currentHint" />

      <div style="margin-top: 1rem">
        <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem">
          Paste 10×10 puzzle
        </div>
        <div class="subtle-text" style="margin-bottom: 0.35rem">
          Space-separated entries, each like <code>3</code>, <code>3s</code> (star), or <code>3x</code> (cross).
          Use digits 0–9; 0 will be mapped to region 10.
        </div>
        <textarea
          v-model="importText"
          rows="6"
          style="width: 100%; resize: vertical; border-radius: 0.5rem; border: 1px solid rgba(148,163,184,0.5); background:#020617; color:#e5e7eb; padding:0.5rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:0.8rem;"
        />
        <div style="margin-top: 0.4rem; display:flex; justify-content: space-between; align-items: center;">
          <button
            type="button"
            class="btn secondary"
            @click="applyImport"
          >
            Apply pasted puzzle
          </button>
          <span v-if="importError" style="color:#f97373; font-size:0.78rem;">
            {{ importError }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>


