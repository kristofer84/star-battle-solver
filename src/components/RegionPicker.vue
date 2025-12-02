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
  // Regions are internally 1–10; display as A–J for clarity.
  // 1 -> 'A', 2 -> 'B', ..., 10 -> 'J'
  return String.fromCharCode(64 + id);
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
        :key="id"
        type="button"
        class="region-btn"
        :class="[
          `region-btn-${id}`,
          { active: props.selectedId === id }
        ]"
        @click="onClick(id)"
      >
        {{ regionLabel(id) }}
      </button>
    </div>
  </div>
</template>


