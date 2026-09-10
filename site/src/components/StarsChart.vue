<script setup lang="ts">
import { palette, useChart } from './useChart.ts';
interface Row { name: string; stars: number; language: string | null; url: string }
const props = defineProps<{ rows: Row[] }>();
const languages = [...new Set(props.rows.map((r) => r.language ?? 'other'))];
const color = (l: string | null) => palette[languages.indexOf(l ?? 'other') % palette.length];
const el = useChart(
  () => ({
    tooltip: { trigger: 'item', formatter: (p: { name: string; value: number; dataIndex: number }) => `<b>${p.name}</b><br>★ ${p.value} · ${props.rows[p.dataIndex].language ?? '—'}` },
    grid: { left: 8, right: 32, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#95a5a6' }, splitLine: { lineStyle: { color: '#ecf0f1' } } },
    yAxis: { type: 'category', data: props.rows.map((r) => r.name), inverse: true, axisLabel: { color: '#212529' }, axisTick: { show: false } },
    series: [
      { type: 'bar', data: props.rows.map((r) => ({ value: r.stars, itemStyle: { color: color(r.language) } })), barCategoryGap: '30%', label: { show: true, position: 'right', color: '#95a5a6' } },
    ],
  }),
  (params) => {
    const url = props.rows[(params as { dataIndex: number }).dataIndex]?.url;
    if (url) window.open(url, '_blank', 'noopener');
  },
);
</script>

<template>
  <figure>
    <div ref="el" :style="{ height: `${rows.length * 24 + 50}px` }" role="img" aria-label="Stars per repository"></div>
    <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Primary language">
      <li v-for="l in languages" :key="l"><i class="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" :style="{ background: color(l) }" />{{ l }}</li>
    </ul>
    <figcaption class="mt-1 text-xs text-muted">Stars per repository, coloured by primary language; click a bar to open the repository.</figcaption>
  </figure>
</template>
