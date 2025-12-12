<script setup lang="ts">
import { computed } from 'vue';
import type { Hint } from '../types/hints';
import { techniqueNameById } from '../logic/techniques';
import { idToLetter } from '../logic/helpers';

const props = defineProps<{
  hint: Hint | null;
}>();

const emit = defineEmits<{
  (e: 'patternClick', patternId: string): void;
}>();

function extractPatternId(explanation: string): string | null {
  const match = explanation.match(/\[([a-f0-9]{6})\]/);
  return match ? match[1] : null;
}

function onPatternIdClick(patternId: string) {
  emit('patternClick', patternId);
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

    <div v-if="!hint" class="subtle-text">
      No hint yet. In Play mode, press “Get hint” to search for the next forced move.
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
    </div>
  </div>
</template>


