<script setup lang="ts">
import type { PuzzleState, Coords } from '../types/puzzle';
import type { HintHighlight } from '../types/hints';
import type { RuleViolations } from '../logic/validation';

const props = defineProps<{
  state: PuzzleState;
  selectionMode: 'region' | 'star' | 'cross' | 'erase';
  selectedRegionId?: number;
  hintHighlight?: HintHighlight | null;
  resultCells?: Coords[];
  showRowColNumbers?: boolean;
  showAreaLabels?: boolean;
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
  // Only highlight cells that will receive a star or cross
  return props.resultCells?.some((c) => c.row === row && c.col === col) ?? false;
}

function getHighlightType(row: number, col: number): 'cells' | null {
  // Only return type for cells that will receive a star or cross
  if (props.resultCells?.some((c) => c.row === row && c.col === col)) return 'cells';
  return null;
}

function isHighlightedRow(row: number): boolean {
  const h = props.hintHighlight;
  return h?.rows?.includes(row) ?? false;
}

function isHighlightedCol(col: number): boolean {
  const h = props.hintHighlight;
  return h?.cols?.includes(col) ?? false;
}

function isHighlightedRegion(row: number, col: number): boolean {
  const h = props.hintHighlight;
  if (!h) return false;
  const regionId = cellRegionId(row, col);
  return h.regions?.includes(regionId) ?? false;
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
  // Regions are internally 0–9; display as A–J.
  // 0 -> 'A', 1 -> 'B', ..., 9 -> 'J'
  return String.fromCharCode(65 + id);
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

function getCellClasses(row: number, col: number): string[] {
  const classes: string[] = [
    `board-cell-region-${cellRegionId(row, col)}`,
  ];

  // Precedence order: Violations > Highlights > Region borders
  // Always add all classes - CSS will handle precedence through specificity and order
  // But we can optimize by not adding region border classes when they'll be completely overridden
  
  const regionBorders = getRegionBorderClasses(row, col);
  const violations = getViolationClasses(row, col);
  const hasRowViolation = violations.includes('violation-row');
  const hasColViolation = violations.includes('violation-col');
  const hasRowHighlight = isHighlightedRow(row);
  const hasColHighlight = isHighlightedCol(col);
  const hasRegionHighlight = isHighlightedRegion(row, col);

  // Add region borders - CSS needs these for combined selectors even if overridden
  // The CSS order and specificity will ensure correct precedence
  classes.push(...regionBorders);

  // Add violation classes (highest precedence - added first so CSS can override later)
  classes.push(...violations);

  // Add highlight classes (medium precedence)
  if (isHighlightedCell(row, col)) {
    classes.push('highlight-cell');
    const highlightType = getHighlightType(row, col);
    if (highlightType) {
      classes.push(`highlight-${highlightType}`);
    }
  }

  if (hasRowHighlight) {
    classes.push('highlight-row');
  }

  if (hasColHighlight) {
    classes.push('highlight-col');
  }

  if (hasRegionHighlight) {
    classes.push('highlight-region-border');
  }

  // Cell state
  const cellState = props.state.cells[row][col];
  if (cellState === 'star') {
    classes.push('star');
  } else if (cellState === 'cross') {
    classes.push('cross');
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
        :class="{ 'highlight-col-outline': isHighlightedCol(col - 1) }"
      >
        {{ col - 1 }}
      </div>
      
      <!-- Row labels and cells -->
      <template v-for="row in state.def.size" :key="`row-${row}`">
        <div 
          class="board-label board-label-row"
          :class="{ 'highlight-row-outline': isHighlightedRow(row - 1) }"
        >
          {{ row - 1 }}
        </div>
        <div
          v-for="col in state.def.size"
          :key="`cell-${row}-${col}`"
          class="board-cell"
          :class="getCellClasses(row - 1, col - 1)"
          @click="onCellClick(row - 1, col - 1)"
        >
          <span v-if="state.cells[row - 1][col - 1] === 'star'">★</span>
          <span v-else-if="state.cells[row - 1][col - 1] === 'cross'">×</span>
          <span v-else-if="props.mode === 'editor' || (props.mode === 'play' && props.showAreaLabels)" 
            :class="['cell-region-number', { 'cell-region-number-faded': props.mode === 'play' }]">
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
        :class="getCellClasses(indexToCoords(index, state.def.size).row, indexToCoords(index, state.def.size).col)"
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
          v-else-if="props.mode === 'editor' || (props.mode === 'play' && props.showAreaLabels)"
          :class="['cell-region-number', { 'cell-region-number-faded': props.mode === 'play' }]"
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


