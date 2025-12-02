<script setup lang="ts">
import type { PuzzleState, Coords } from '../types/puzzle';
import type { HintHighlight } from '../types/hints';

const props = defineProps<{
  state: PuzzleState;
  selectionMode: 'region' | 'star' | 'cross' | 'erase';
  selectedRegionId?: number;
  hintHighlight?: HintHighlight | null;
}>();

const emit = defineEmits<{
  (e: 'cellClick', coords: Coords): void;
}>();

function onCellClick(row: number, col: number) {
  emit('cellClick', { row, col });
}

function indexToCoords(index: number, size: number): Coords {
  const zeroBased = index - 1;
  const row = Math.floor(zeroBased / size);
  const col = zeroBased % size;
  return { row, col };
}

function cellRegionId(row: number, col: number): number {
  return props.state.def.regions[row][col];
}

function isHighlightedCell(row: number, col: number): boolean {
  const h = props.hintHighlight;
  if (!h) return false;
  if (h.cells?.some((c) => c.row === row && c.col === col)) return true;
  if (h.rows?.includes(row)) return true;
  if (h.cols?.includes(col)) return true;
  const regionId = cellRegionId(row, col);
  if (h.regions?.includes(regionId)) return true;
  return false;
}

function getRegionBorderClasses(row: number, col: number): string[] {
  const classes: string[] = [];
  const currentRegion = cellRegionId(row, col);
  const size = props.state.def.size;
  
  // Check top
  if (row === 0 || cellRegionId(row - 1, col) !== currentRegion) {
    classes.push('region-border-top');
  }
  // Check right
  if (col === size - 1 || cellRegionId(row, col + 1) !== currentRegion) {
    classes.push('region-border-right');
  }
  // Check bottom
  if (row === size - 1 || cellRegionId(row + 1, col) !== currentRegion) {
    classes.push('region-border-bottom');
  }
  // Check left
  if (col === 0 || cellRegionId(row, col - 1) !== currentRegion) {
    classes.push('region-border-left');
  }
  
  return classes;
}
</script>

<template>
  <div class="board-wrapper">
    <div class="board-grid">
      <div
        v-for="index in state.def.size * state.def.size"
        :key="index"
        class="board-cell"
        :class="[
          `board-cell-region-${cellRegionId(indexToCoords(index, state.def.size).row, indexToCoords(index, state.def.size).col)}`,
          ...getRegionBorderClasses(indexToCoords(index, state.def.size).row, indexToCoords(index, state.def.size).col),
          {
            'highlight-cell': isHighlightedCell(
              indexToCoords(index, state.def.size).row,
              indexToCoords(index, state.def.size).col,
            ),
            star:
              state.cells[indexToCoords(index, state.def.size).row][
                indexToCoords(index, state.def.size).col
              ] === 'star',
            cross:
              state.cells[indexToCoords(index, state.def.size).row][
                indexToCoords(index, state.def.size).col
              ] === 'cross',
          },
        ]"
        @click="
          onCellClick(
            indexToCoords(index, state.def.size).row,
            indexToCoords(index, state.def.size).col,
          )
        "
      >
        <span
          v-if="
            state.cells[indexToCoords(index, state.def.size).row][
              indexToCoords(index, state.def.size).col
            ] === 'star'
          "
          >★</span
        >
        <span
          v-else-if="
            state.cells[indexToCoords(index, state.def.size).row][
              indexToCoords(index, state.def.size).col
            ] === 'cross'
          "
          >×</span
        >
      </div>
    </div>
  </div>
</template>


