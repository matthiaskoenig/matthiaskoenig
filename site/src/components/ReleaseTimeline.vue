<script setup lang="ts">
import { useChart } from './useChart.ts';
import { releaseTimelineHeight, releaseTimelineOption } from '../lib/chart-options.ts';
import type { ReleaseRow } from '../lib/charts.ts';
const props = defineProps<{ rows: ReleaseRow[] }>();
const el = useChart(
  () => releaseTimelineOption(props.rows),
  (params) => {
    const url = (params as { value?: unknown[] }).value?.[3];
    if (typeof url === 'string') window.open(url, '_blank', 'noopener');
  },
);
</script>

<template>
  <figure>
    <div ref="el" :style="{ height: `${releaseTimelineHeight(rows.length)}px` }" role="img" aria-label="Release dates per repository"></div>
    <figcaption class="mt-1 text-xs text-muted">One dot per release; drag the slider to zoom, click a dot to open the release.</figcaption>
  </figure>
</template>
