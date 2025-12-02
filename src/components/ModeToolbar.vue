<script setup lang="ts">
type Mode = 'editor' | 'play';
type SelectionMode = 'region' | 'star' | 'cross' | 'erase';

const props = defineProps<{
  mode: Mode;
  selectionMode: SelectionMode;
  showRowColNumbers: boolean;
}>();

const emit = defineEmits<{
  (e: 'changeMode', mode: Mode): void;
  (e: 'changeSelection', mode: SelectionMode): void;
  (e: 'requestHint'): void;
  (e: 'applyHint'): void;
  (e: 'clear'): void;
  (e: 'toggleRowColNumbers'): void;
}>();
</script>

<template>
  <div>
    <div class="toolbar-row" style="margin-bottom: 0.35rem">
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

    <div v-if="props.mode === 'editor'" class="subtle-text">
      Click cells to assign them to the selected region. All 100 cells should belong to regions 1–10.
    </div>

    <div class="toolbar-row" style="margin-top: 0.5rem">
      <button
        type="button"
        class="btn secondary"
        :class="{ active: props.showRowColNumbers }"
        @click="emit('toggleRowColNumbers')"
      >
        Show row/col numbers
      </button>
    </div>

    <div v-if="props.mode === 'play'" class="toolbar-row">
      <button
        type="button"
        class="btn secondary"
        :class="{ active: props.selectionMode === 'star' }"
        @click="emit('changeSelection', 'star')"
      >
        ★ Star
      </button>
      <button
        type="button"
        class="btn secondary"
        :class="{ active: props.selectionMode === 'cross' }"
        @click="emit('changeSelection', 'cross')"
      >
        × Cross
      </button>
      <button
        type="button"
        class="btn secondary"
        :class="{ active: props.selectionMode === 'erase' }"
        @click="emit('changeSelection', 'erase')"
      >
        Erase
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
        class="btn"
        style="margin-left: auto"
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
    </div>
  </div>
</template>


