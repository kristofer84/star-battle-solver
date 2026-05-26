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

const PROOF_SEPARATOR = '\n\nProof:\n';

const mainExplanation = computed(() => {
  if (!props.hint) return '';
  const idx = props.hint.explanation.indexOf(PROOF_SEPARATOR);
  return idx >= 0 ? props.hint.explanation.substring(0, idx) : props.hint.explanation;
});

const proofText = computed(() => {
  if (!props.hint) return null;
  const idx = props.hint.explanation.indexOf(PROOF_SEPARATOR);
  return idx >= 0 ? props.hint.explanation.substring(idx + PROOF_SEPARATOR.length) : null;
});

// Split main explanation into sentences for step-by-step readability
const explanationSentences = computed(() => {
  const text = mainExplanation.value;
  if (!text) return [];
  // Split on ". " at sentence boundaries (next char is uppercase or digit)
  const sentences = text.split(/\.\s+(?=[A-Z0-9])/g);
  return sentences.map((s, i) =>
    i < sentences.length - 1 && !s.endsWith('.') ? s + '.' : s
  ).filter(s => s.trim().length > 0);
});

function parseTextWithPatternIds(text: string): Array<{ text: string; isPatternId: boolean }> {
  const parts: Array<{ text: string; isPatternId: boolean }> = [];
  const patternIdRegex = /\[([a-f0-9]{6})\]/g;
  let lastIndex = 0;
  let match;
  while ((match = patternIdRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), isPatternId: false });
    }
    parts.push({ text: match[1], isPatternId: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), isPatternId: false });
  }
  return parts;
}

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
      <!-- Highlights first so the user knows where to look before reading -->
      <div v-if="hint.highlights && (hint.highlights.rows?.length || hint.highlights.cols?.length || hint.highlights.regions?.length || hint.highlights.cells?.length)" class="hint-legend">
        <div class="hint-badge-row">
          <span v-if="hint.highlights?.rows?.length" class="hint-chip rows">
            Rows: {{ hint.highlights.rows.map((r) => r + 1).join(', ') }}
          </span>
          <span v-if="hint.highlights?.cols?.length" class="hint-chip cols">
            Columns: {{ hint.highlights.cols.map((c) => c + 1).join(', ') }}
          </span>
          <span v-if="hint.highlights?.regions?.length" class="hint-chip regions">
            Regions: {{ hint.highlights.regions.map(idToLetter).join(', ') }}
          </span>
          <span v-if="hint.highlights?.cells?.length" class="hint-chip cells">
            {{ hint.highlights.cells.length }} cell{{ hint.highlights.cells.length === 1 ? '' : 's' }} highlighted
          </span>
        </div>
      </div>

      <!-- Main explanation as numbered steps when multiple sentences -->
      <ol v-if="explanationSentences.length > 1" class="hint-steps">
        <li v-for="(sentence, idx) in explanationSentences" :key="`step-${idx}`">
          <template v-for="(part, pIdx) in parseTextWithPatternIds(sentence)" :key="pIdx">
            <span v-if="part.isPatternId"
              @click="onPatternIdClick(part.text)"
              class="hint-pattern-link"
              :title="`Click to view pattern ${part.text}`">
              [{{ part.text }}]
            </span>
            <span v-else>{{ part.text }}</span>
          </template>
        </li>
      </ol>
      <p v-else style="font-size: 0.88rem; line-height: 1.4; white-space: pre-line">
        <template v-for="(part, idx) in parseTextWithPatternIds(mainExplanation)" :key="idx">
          <span v-if="part.isPatternId"
            @click="onPatternIdClick(part.text)"
            class="hint-pattern-link"
            :title="`Click to view pattern ${part.text}`">
            [{{ part.text }}]
          </span>
          <span v-else>{{ part.text }}</span>
        </template>
      </p>

      <!-- Proof in collapsible section -->
      <details v-if="proofText" class="hint-proof">
        <summary class="hint-proof__summary">Verification</summary>
        <p class="hint-proof__body">{{ proofText }}</p>
      </details>

      <div v-if="hintDetails.length" class="hint-details">
        <div class="hint-details__title">Main solver context</div>
        <ul class="hint-details__list">
          <li v-for="(detail, idx) in hintDetails" :key="`detail-${idx}`">{{ detail }}</li>
        </ul>
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
.hint-steps {
  margin: 0.4rem 0 0.5rem 0;
  padding-left: 1.4rem;
  font-size: 0.88rem;
  line-height: 1.5;
}

.hint-steps li {
  margin-bottom: 0.3rem;
}

.hint-steps li:last-child {
  margin-bottom: 0;
}

.hint-pattern-link {
  color: #60a5fa;
  cursor: pointer;
  text-decoration: underline;
}

.hint-proof {
  margin-top: 0.6rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.6);
}

.hint-proof__summary {
  padding: 0.4rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #94a3b8;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.hint-proof__summary::before {
  content: '▶ ';
  font-size: 0.65rem;
}

details[open] .hint-proof__summary::before {
  content: '▼ ';
}

.hint-proof__body {
  padding: 0 0.6rem 0.5rem;
  font-size: 0.8rem;
  color: #94a3b8;
  line-height: 1.4;
  margin: 0;
}

.hint-details {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.92));
}

.hint-details__title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.hint-details__subtitle {
  margin: 0 0 0.35rem 0;
  color: #cbd5e1;
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


