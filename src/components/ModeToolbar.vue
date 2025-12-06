<script setup lang="ts">
type Mode = 'editor' | 'play';
type SelectionMode = 'region' | 'star' | 'cross' | 'erase';

const props = defineProps<{
  mode: Mode;
  selectionMode: SelectionMode;
  showRowColNumbers: boolean;
  showAreaLabels: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
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
}>();
</script>

<template>
  <div class="mode-toolbar">
    <div class="toolbar-row toolbar-row--mode">
      <button
        type="button"
        class="btn"
        :class="{ active: props.mode === 'editor' }"
        @click="emit('changeMode', 'editor')"
      >
        Editor mode
      </button>
      <button
        type="button"
        class="btn"
        :class="{ active: props.mode === 'play' }"
        @click="emit('changeMode', 'play')"
      >
        Play mode
      </button>
    </div>

    <div class="toolbar-row toolbar-row--single">
      <button
        type="button"
        class="btn secondary"
        :class="{ active: props.showRowColNumbers }"
        @click="emit('toggleRowColNumbers')"
      >
        Show row/col numbers
      </button>
    </div>
    
    <div v-if="props.mode === 'editor'" class="subtle-text">
      Click cells to assign them to the selected region. All 100 cells should belong to regions 1–10.
    </div>

    <div v-if="props.mode === 'play'" class="toolbar-row toolbar-row--actions">
      <button
        type="button"
        class="btn secondary"
        :class="{ active: props.showAreaLabels }"
        @click="emit('toggleAreaLabels')"
      >
        Show area labels
      </button>
      <button
        type="button"
        class="btn secondary"
        @click="emit('clear')"
      >
        Clear
      </button>
      <button
        type="button"
        class="btn secondary"
        :disabled="!props.canUndo"
        @click="emit('undo')"
      >
        ↶ Undo
      </button>
      <button
        type="button"
        class="btn secondary"
        :disabled="!props.canRedo"
        @click="emit('redo')"
      >
        ↷ Redo
      </button>
    </div>

    <div v-if="props.mode === 'play'" class="toolbar-row toolbar-row--solver">
      <button
        type="button"
        class="btn"
        @click="emit('requestHint')"
      >
        Get hint
      </button>
      <button
        type="button"
        class="btn secondary"
        @click="emit('applyHint')"
      >
        Apply move
      </button>
      <button
        type="button"
        class="btn"
        @click="emit('trySolve')"
      >
        Try solve
      </button>
    </div>
  </div>
</template>


