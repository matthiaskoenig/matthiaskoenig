<script setup lang="ts">
import { palette, useChart } from './useChart.ts';
interface Point { date: string; tag: string; url: string; name: string }
interface Row { name: string; repo: string; points: Point[] }
const props = defineProps<{ rows: Row[] }>();

const names = props.rows.map((r) => r.name);
const el = useChart(
  () => ({
    tooltip: {
      trigger: 'item',
      formatter: (p: { value: [string, number, string, string] }) => `<b>${names[p.value[1]]}</b> ${p.value[2]}<br>${p.value[0].slice(0, 10)}`,
    },
    grid: { left: 8, right: 16, top: 8, bottom: 56, containLabel: true },
    xAxis: { type: 'time', axisLabel: { color: '#95a5a6' } },
    yAxis: { type: 'category', data: names, inverse: true, axisLabel: { color: '#212529' }, axisTick: { show: false } },
    dataZoom: [{ type: 'slider', xAxisIndex: 0, height: 20, bottom: 12, borderColor: '#ecf0f1' }, { type: 'inside', xAxisIndex: 0 }],
    series: [
      {
        type: 'scatter',
        symbolSize: 11,
        data: props.rows.flatMap((r, i) => r.points.map((p) => ({ value: [p.date, i, p.tag, p.url], itemStyle: { color: palette[i % palette.length] } }))),
        emphasis: { scale: 1.6 },
      },
    ],
  }),
  (params) => {
    const url = (params as { value?: unknown[] }).value?.[3];
    if (typeof url === 'string') window.open(url, '_blank', 'noopener');
  },
);
</script>

<template>
  <figure>
    <div ref="el" :style="{ height: `${Math.max(220, rows.length * 26 + 90)}px` }" role="img" aria-label="Release dates per repository"></div>
    <figcaption class="mt-1 text-xs text-muted">One dot per release; drag the slider to zoom, click a dot to open the release.</figcaption>
  </figure>
</template>
