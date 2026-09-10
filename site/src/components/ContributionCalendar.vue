<script setup lang="ts">
import { computed, ref } from 'vue';

interface Day { date: string; count: number; level: number }
const props = defineProps<{ weeks: { days: Day[] }[]; total: number }>();

const hovered = ref<Day | null>(null);
const colors = ['#ecf0f1', '#a8e6d6', '#5fd1b3', '#18bc9c', '#0f7c67'];
const cell = 12;
const gap = 3;
const step = cell + gap;

const months = computed(() => {
  const out: { label: string; col: number }[] = [];
  let last = '';
  props.weeks.forEach((w, i) => {
    const d = w.days[0];
    if (!d) return;
    const m = d.date.slice(0, 7);
    if (m !== last) {
      out.push({ label: new Date(d.date).toLocaleString('en', { month: 'short', timeZone: 'UTC' }), col: i });
      last = m;
    }
  });
  return out;
});
const width = computed(() => props.weeks.length * step);
const height = 7 * step + 16;
const dayRow = (date: string) => new Date(date).getUTCDay();
</script>

<template>
  <figure>
    <div class="overflow-x-auto">
      <svg :width="width" :height="height" role="img" :aria-label="`${total} contributions in the last year`">
        <text v-for="m in months" :key="m.col" :x="m.col * step" y="10" font-size="10" fill="#95a5a6">{{ m.label }}</text>
        <g v-for="(w, wi) in weeks" :key="wi">
          <rect
            v-for="d in w.days"
            :key="d.date"
            :x="wi * step"
            :y="16 + dayRow(d.date) * step"
            :width="cell"
            :height="cell"
            rx="2"
            :fill="colors[d.level]"
            tabindex="0"
            @mouseenter="hovered = d"
            @mouseleave="hovered = null"
            @focus="hovered = d"
            @blur="hovered = null"
          >
            <title>{{ d.count }} contributions on {{ d.date }}</title>
          </rect>
        </g>
      </svg>
    </div>
    <figcaption class="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-ink/70">
      <span aria-live="polite">{{ hovered ? `${hovered.count} contributions on ${hovered.date}` : `${total} contributions in the last year` }}</span>
      <span class="flex items-center gap-1">
        Less
        <i v-for="c in colors" :key="c" class="inline-block h-3 w-3 rounded-sm" :style="{ background: c }" />
        More
      </span>
    </figcaption>
  </figure>
</template>
