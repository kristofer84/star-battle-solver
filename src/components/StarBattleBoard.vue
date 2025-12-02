<script setup lang="ts">
import type { PuzzleState, Coords } from '../types/puzzle';
import type { HintHighlight } from '../types/hints';
import type { RuleViolations } from '../logic/validation';

const props = defineProps<{
  state: PuzzleState;
  selectionMode: 'region' | 'star' | 'cross' | 'erase';
  selectedRegionId?: number;
  hintHighlight?: HintHighlight | null;
  showRowColNumbers?: boolean;
  mode?: 'editor' | 'play';
  violations?: RuleViolations;
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

function regionLabel(id: number): string {
  // Regions are internally 1–10; display as A–J.
  // 1 -> 'A', 2 -> 'B', ..., 10 -> 'J'
  return String.fromCharCode(64 + id);
}

function hasRowViolation(row: number): boolean {
  return props.violations?.rows.has(row) ?? false;
}

function hasColViolation(col: number): boolean {
  return props.violations?.cols.has(col) ?? false;
}

function hasRegionViolation(row: number, col: number): boolean {
  const regionId = cellRegionId(row, col);
  return props.violations?.regions.has(regionId) ?? false;
}

function hasAdjacentViolation(row: number, col: number): boolean {
  return props.violations?.adjacentCells.has(`${row},${col}`) ?? false;
}

function getViolationClasses(row: number, col: number): string[] {
  const classes: string[] = [];
  if (hasRowViolation(row)) {
    classes.push('violation-row');
  }
  if (hasColViolation(col)) {
    classes.push('violation-col');
  }
  if (hasRegionViolation(row, col)) {
    classes.push('violation-region');
  }
  if (hasAdjacentViolation(row, col)) {
    classes.push('violation-adjacent');
  }
  return classes;
}
</script>

<template>
  <div class="board-wrapper">
    <div v-if="props.showRowColNumbers" class="board-with-labels">
      <!-- Column headers -->
      <div class="board-label-corner"></div>
      <div
        v-for="col in state.def.size"
        :key="`col-${col}`"
        class="board-label board-label-col"
      >
        {{ col - 1 }}
      </div>
      
      <!-- Row labels and cells -->
      <template v-for="row in state.def.size" :key="`row-${row}`">
        <div class="board-label board-label-row">
          {{ row - 1 }}
        </div>
        <div
          v-for="col in state.def.size"
          :key="`cell-${row}-${col}`"
          class="board-cell"
          :class="[
            `board-cell-region-${cellRegionId(row - 1, col - 1)}`,
            ...getRegionBorderClasses(row - 1, col - 1),
            ...getViolationClasses(row - 1, col - 1),
            {
              'highlight-cell': isHighlightedCell(row - 1, col - 1),
              star: state.cells[row - 1][col - 1] === 'star',
              cross: state.cells[row - 1][col - 1] === 'cross',
            },
          ]"
          @click="onCellClick(row - 1, col - 1)"
        >
          <span v-if="state.cells[row - 1][col - 1] === 'star'">★</span>
          <span v-else-if="state.cells[row - 1][col - 1] === 'cross'">×</span>
          <span v-else-if="props.mode === 'editor'" class="cell-region-number">
            {{ regionLabel(cellRegionId(row - 1, col - 1)) }}
          </span>
        </div>
      </template>
    </div>
    
    <div v-else class="board-grid">
      <div
        v-for="index in state.def.size * state.def.size"
        :key="index"
        class="board-cell"
        :class="[
          `board-cell-region-${cellRegionId(indexToCoords(index, state.def.size).row, indexToCoords(index, state.def.size).col)}`,
          ...getRegionBorderClasses(indexToCoords(index, state.def.size).row, indexToCoords(index, state.def.size).col),
          ...getViolationClasses(indexToCoords(index, state.def.size).row, indexToCoords(index, state.def.size).col),
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
        <span
          v-else-if="props.mode === 'editor'"
          class="cell-region-number"
        >
          {{
            regionLabel(
              cellRegionId(
                indexToCoords(index, state.def.size).row,
                indexToCoords(index, state.def.size).col,
              )
            )
          }}
        </span>
      </div>
    </div>
  </div>
</template>


