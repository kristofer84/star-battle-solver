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
</script>

<template>
  <div>
    <div class="subtle-text" style="margin-bottom: 0.35rem">
      Regions
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
        {{ id }}
      </button>
    </div>
  </div>
</template>


