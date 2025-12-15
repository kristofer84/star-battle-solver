<script setup lang="ts">
import { computed } from 'vue';
import type { Hint } from '../types/hints';
import type { Deduction } from '../types/deductions';
import type { Coords } from '../types/puzzle';
import { techniqueNameById } from '../logic/techniques';
import { idToLetter } from '../logic/helpers';

const props = defineProps<{
  hint: Hint | null;
  deductions?: Deduction[];
}>();

const emit = defineEmits<{
  (e: 'patternClick', patternId: string): void;
}>();

function onPatternIdClick(patternId: string) {
  emit('patternClick', patternId);
}

function formatCoords(cell: Coords): string {
  return `R${cell.row + 1}C${cell.col + 1}`;
}

function formatAreaLabel(areaType: 'row' | 'column' | 'region', areaId: number): string {
  if (areaType === 'row') return `Row ${areaId + 1}`;
  if (areaType === 'column') return `Column ${areaId + 1}`;
  return `Region ${idToLetter(areaId)}`;
}

function formatCellList(cells: Coords[], limit = 6): string {
  if (!cells.length) return 'none';
  const clipped = cells.slice(0, limit).map(formatCoords);
  if (cells.length > limit) {
    clipped.push(`… +${cells.length - limit} more`);
  }
  return clipped.join(', ');
}

function summarizeDeduction(deduction: Deduction): string {
  switch (deduction.kind) {
    case 'cell': {
      const target = deduction.type === 'forceStar' ? 'a star' : 'empty';
      const base = `${formatCoords(deduction.cell)} must be ${target} (${deduction.technique})`;
      return deduction.explanation ? `${base} – ${deduction.explanation}` : base;
    }
    case 'block': {
      const bounds =
        deduction.starsRequired !== undefined
          ? `${deduction.starsRequired} star${deduction.starsRequired === 1 ? '' : 's'}`
          : deduction.maxStars !== undefined
            ? `≤ ${deduction.maxStars} star${deduction.maxStars === 1 ? '' : 's'}`
            : deduction.minStars !== undefined
              ? `≥ ${deduction.minStars} star${deduction.minStars === 1 ? '' : 's'}`
              : 'star bound';
      const base = `Block (${deduction.block.bRow},${deduction.block.bCol}) ${bounds} (${deduction.technique})`;
      return deduction.explanation ? `${base} – ${deduction.explanation}` : base;
    }
    case 'area': {
      const label = formatAreaLabel(deduction.areaType, deduction.areaId);
      const boundParts: string[] = [];
      if (deduction.starsRequired !== undefined) {
        boundParts.push(`needs ${deduction.starsRequired}`);
      }
      if (deduction.minStars !== undefined && deduction.starsRequired === undefined) {
        boundParts.push(`min ${deduction.minStars}`);
      }
      if (deduction.maxStars !== undefined && deduction.starsRequired === undefined) {
        boundParts.push(`max ${deduction.maxStars}`);
      }
      const bounds = boundParts.length > 0 ? ` (${boundParts.join(', ')})` : '';
      const base = `${label}${bounds} via ${deduction.technique}. Candidates: ${formatCellList(deduction.candidateCells)}.`;
      return deduction.explanation ? `${base} ${deduction.explanation}` : base;
    }
    case 'exclusive-set': {
      const base = `Exclusive set (${formatCellList(deduction.cells)}) requires ${deduction.starsRequired} star${deduction.starsRequired === 1 ? '' : 's'} (${deduction.technique})`;
      return deduction.explanation ? `${base} – ${deduction.explanation}` : base;
    }
    case 'area-relation': {
      const areaSummary = deduction.areas
        .map((area) => `${formatAreaLabel(area.areaType, area.areaId)}: ${formatCellList(area.candidateCells, 4)}`)
        .join(' · ');
      const base = `Area relation (${deduction.technique}) totals ${deduction.totalStars} star${deduction.totalStars === 1 ? '' : 's'} across ${deduction.areas.length} area${deduction.areas.length === 1 ? '' : 's'}. ${areaSummary}`;
      return deduction.explanation ? `${base} – ${deduction.explanation}` : base;
    }
  }
}

const explanationParts = computed(() => {
  if (!props.hint) return [];
  const explanation = props.hint.explanation;
  const parts: Array<{ text: string; isPatternId: boolean }> = [];
  const patternIdRegex = /\[([a-f0-9]{6})\]/g;
  let lastIndex = 0;
  let match;
  
  while ((match = patternIdRegex.exec(explanation)) !== null) {
    // Add text before the pattern ID
    if (match.index > lastIndex) {
      parts.push({ text: explanation.substring(lastIndex, match.index), isPatternId: false });
    }
    // Add the pattern ID
    parts.push({ text: match[1], isPatternId: true });
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < explanation.length) {
    parts.push({ text: explanation.substring(lastIndex), isPatternId: false });
  }

  return parts;
});

const hintDetails = computed(() => props.hint?.details ?? []);

const deductionDisplayLimit = 12;
const deductionSummaries = computed(() => {
  if (!props.deductions || props.deductions.length === 0) return [];
  return props.deductions.slice(0, deductionDisplayLimit).map(summarizeDeduction);
});

const hiddenDeductionCount = computed(() => {
  if (!props.deductions || props.deductions.length <= deductionDisplayLimit) return 0;
  return props.deductions.length - deductionDisplayLimit;
});
</script>

<template>
  <div>
    <div class="card-header">
      <div>
        <div style="font-size: 0.9rem; font-weight: 600">
          Hint
        </div>
        <div v-if="hint" class="subtle-text">
          {{ techniqueNameById[hint.technique] }} ({{ hint.technique }})
        </div>
      </div>
      <div class="pill">
        Logical
      </div>
    </div>

    <div v-if="!hint">
      <div class="subtle-text">
        No hint yet. In Play mode, press “Get hint” to search for the next forced move.
      </div>
      <div v-if="deductionSummaries.length" class="hint-details">
        <div class="hint-details__title">Filtered deductions available</div>
        <p class="hint-details__subtitle">
          The solver could not form an exact hint, but these deductions remain after cleanup:
        </p>
        <ul class="hint-details__list">
          <li v-for="(summary, idx) in deductionSummaries" :key="`deduction-${idx}`">{{ summary }}</li>
        </ul>
        <div v-if="hiddenDeductionCount > 0" class="subtle-text">
          +{{ hiddenDeductionCount }} more deduction{{ hiddenDeductionCount === 1 ? '' : 's' }} not shown
        </div>
      </div>
    </div>

    <div v-else>
      <p style="font-size: 0.88rem; line-height: 1.4; white-space: pre-line">
        <template v-for="(part, idx) in explanationParts" :key="idx">
          <span v-if="part.isPatternId"
            @click="onPatternIdClick(part.text)"
            style="color: #60a5fa; cursor: pointer; text-decoration: underline;"
            :title="`Click to view pattern ${part.text}`">
            [{{ part.text }}]
          </span>
          <span v-else>{{ part.text }}</span>
        </template>
      </p>
      <div v-if="hintDetails.length" class="hint-details">
        <div class="hint-details__title">Main solver context</div>
        <ul class="hint-details__list">
          <li v-for="(detail, idx) in hintDetails" :key="`detail-${idx}`">{{ detail }}</li>
        </ul>
      </div>
      <div class="hint-legend">
        Visual highlights:
        <div class="hint-badge-row">
          <span
            v-if="hint.highlights?.rows?.length"
            class="hint-chip rows"
          >
            Rows: {{ hint.highlights.rows.map((r) => r + 1).join(', ') }}
          </span>
          <span
            v-if="hint.highlights?.cols?.length"
            class="hint-chip cols"
          >
            Columns: {{ hint.highlights.cols.map((c) => c + 1).join(', ') }}
          </span>
          <span
            v-if="hint.highlights?.regions?.length"
            class="hint-chip regions"
          >
            Regions: {{ hint.highlights.regions.map(idToLetter).join(', ') }}
          </span>
          <span
            v-if="hint.highlights?.cells?.length"
            class="hint-chip cells"
          >
            Cells: {{ hint.highlights.cells.length }}
          </span>
        </div>
      </div>
      <div v-if="deductionSummaries.length" class="hint-details">
        <div class="hint-details__title">Supporting deductions</div>
        <ul class="hint-details__list">
          <li v-for="(summary, idx) in deductionSummaries" :key="`support-${idx}`">{{ summary }}</li>
        </ul>
        <div v-if="hiddenDeductionCount > 0" class="subtle-text">
          +{{ hiddenDeductionCount }} more deduction{{ hiddenDeductionCount === 1 ? '' : 's' }} not shown
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hint-details {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.hint-details__title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.hint-details__subtitle {
  margin: 0 0 0.35rem 0;
  color: #4b5563;
  font-size: 0.9rem;
}

.hint-details__list {
  margin: 0.25rem 0 0.25rem 1rem;
  padding-left: 0.4rem;
  line-height: 1.4;
}

.hint-details__list li + li {
  margin-top: 0.25rem;
}
</style>


