<script setup lang="ts">
import { useChart } from './useChart.ts';
const props = defineProps<{ months: { month: string; count: number }[] }>();
const label = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const el = useChart(() => ({
  tooltip: { trigger: 'axis', formatter: (ps: { name: string; value: number }[]) => `<b>${ps[0].name}</b><br>${ps[0].value} contributions` },
  grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
  xAxis: { type: 'category', data: props.months.map((m) => label(m.month)), axisLabel: { color: '#95a5a6' } },
  yAxis: { type: 'value', axisLabel: { color: '#95a5a6' }, splitLine: { lineStyle: { color: '#ecf0f1' } } },
  series: [{ type: 'bar', data: props.months.map((m) => m.count), itemStyle: { color: '#18bc9c', borderRadius: [3, 3, 0, 0] } }],
}));
</script>

<template>
  <figure>
    <div ref="el" class="h-56" role="img" aria-label="Contributions per month"></div>
    <figcaption class="mt-1 text-xs text-muted">Contributions per month over the last year.</figcaption>
  </figure>
</template>
