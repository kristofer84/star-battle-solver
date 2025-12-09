<script setup lang="ts">
type Mode = 'editor' | 'play';
type SelectionMode = 'region' | 'star' | 'cross' | 'erase';

type ThemeOption = {
  value: string;
  label: string;
};

const props = defineProps<{
  mode: Mode;
  selectionMode: SelectionMode;
  showRowColNumbers: boolean;
  showAreaLabels: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  regionTheme: string;
  themeOptions: ThemeOption[];
}>();

const emit = defineEmits<{
  (e: 'changeMode', mode: Mode): void;
  (e: 'changeSelection', mode: SelectionMode): void;
  (e: 'requestHint'): void;
  (e: 'applyHint'): void;
  (e: 'trySolve'): void;
  (e: 'clear'): void;
  (e: 'toggleRowColNumbers'): void;
  (e: 'toggleAreaLabels'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'changeTheme', theme: string): void;
}>();
</script>

<template>
  <div class="mode-toolbar">
    <div class="toolbar-row toolbar-row--mode">
      <div class="mode-toggle" role="group" aria-label="Switch between editor and play mode">
        <button
          type="button"
          class="mode-toggle__option"
          :class="{ active: props.mode === 'editor' }"
          :aria-pressed="props.mode === 'editor'"
          @click="emit('changeMode', 'editor')"
        >
          <span class="material-symbols-outlined btn__icon" aria-hidden="true">edit</span>
          <span>Editor</span>
        </button>
        <button
          type="button"
          class="mode-toggle__option"
          :class="{ active: props.mode === 'play' }"
          :aria-pressed="props.mode === 'play'"
          @click="emit('changeMode', 'play')"
        >
          <span class="material-symbols-outlined btn__icon" aria-hidden="true">sports_esports</span>
          <span>Play</span>
        </button>
      </div>
    </div>

    <div class="toolbar-row toolbar-row--display">
      <button
        type="button"
        class="btn secondary"
        :class="{ active: props.showRowColNumbers }"
        :aria-pressed="props.showRowColNumbers"
        @click="emit('toggleRowColNumbers')"
      >
        <span class="material-symbols-outlined btn__icon" aria-hidden="true">grid_on</span>
        <span class="btn__label">Row &amp; column numbers</span>
      </button>
      <button
        type="button"
        class="btn secondary"
        :class="{ active: props.showAreaLabels }"
        :aria-pressed="props.showAreaLabels"
        :disabled="props.mode !== 'play'"
        @click="emit('toggleAreaLabels')"
      >
        <span class="material-symbols-outlined btn__icon" aria-hidden="true">label</span>
        <span class="btn__label">Area labels</span>
      </button>
      <label class="theme-select-control">
        <span class="material-symbols-outlined theme-select-control__icon" aria-hidden="true">palette</span>
        <select
          class="theme-select-control__select"
          :value="props.regionTheme"
          aria-label="Select region theme"
          @change="emit('changeTheme', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in props.themeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>
    
    <div v-if="props.mode === 'editor'" class="subtle-text">
      Click cells to assign them to the selected region. All 100 cells should belong to regions 1–10.
    </div>

    <div v-if="props.mode === 'play'" class="toolbar-row toolbar-row--actions">
      <button
        type="button"
        class="btn secondary"
        @click="emit('clear')"
      >
        <span class="material-symbols-outlined btn__icon" aria-hidden="true">backspace</span>
        <span class="btn__label">Clear board</span>
      </button>
      <button
        type="button"
        class="btn secondary"
        :disabled="!props.canUndo"
        @click="emit('undo')"
      >
        <span class="material-symbols-outlined btn__icon" aria-hidden="true">undo</span>
        <span class="btn__label">Undo</span>
      </button>
      <button
        type="button"
        class="btn secondary"
        :disabled="!props.canRedo"
        @click="emit('redo')"
      >
        <span class="material-symbols-outlined btn__icon" aria-hidden="true">redo</span>
        <span class="btn__label">Redo</span>
      </button>
    </div>

    <div v-if="props.mode === 'play'" class="toolbar-row toolbar-row--solver">
      <button
        type="button"
        class="btn"
        @click="emit('requestHint')"
      >
        <span class="material-symbols-outlined btn__icon" aria-hidden="true">tips_and_updates</span>
        <span class="btn__label">Get hint</span>
      </button>
      <button
        type="button"
        class="btn secondary"
        @click="emit('applyHint')"
      >
        <span class="material-symbols-outlined btn__icon" aria-hidden="true">play_arrow</span>
        <span class="btn__label">Apply move</span>
      </button>
      <button
        type="button"
        class="btn"
        @click="emit('trySolve')"
      >
        <span class="material-symbols-outlined btn__icon" aria-hidden="true">auto_awesome</span>
        <span class="btn__label">Try solve</span>
      </button>
    </div>
  </div>
</template>


