<script setup lang="ts">
const props = defineProps<{
  selectedId?: number;
}>();

const emit = defineEmits<{
  (e: 'selectRegion', id: number): void;
}>();

function onClick(id: number) {
  emit('selectRegion', id);
}

function regionLabel(id: number): string {
  // Regions are internally 0–9; display as A–J for clarity.
  // 0 -> 'A', 1 -> 'B', ..., 9 -> 'J'
  return String.fromCharCode(65 + id);
}
</script>

<template>
  <div>
    <div class="subtle-text" style="margin-bottom: 0.35rem">
      Regions (A–J)
    </div>
    <div class="region-picker-grid">
      <button
        v-for="id in 10"
        :key="id - 1"
        type="button"
        class="region-btn"
        :class="[
          `region-btn-${id - 1}`,
          { active: props.selectedId === id - 1 }
        ]"
        @click="onClick(id - 1)"
      >
        {{ regionLabel(id - 1) }}
      </button>
    </div>
  </div>
</template>


