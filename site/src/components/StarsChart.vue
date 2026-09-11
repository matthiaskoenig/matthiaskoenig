<script setup lang="ts">
import { useChart } from './useChart.ts';
import { languageColor, starsHeight, starsLanguages, starsOption, type StarRow } from '../lib/chart-options.ts';
const props = defineProps<{ rows: StarRow[] }>();
const languages = starsLanguages(props.rows);
const color = (l: string | null) => languageColor(languages, l);
const el = useChart(
  () => starsOption(props.rows),
  (params) => {
    const url = props.rows[(params as { dataIndex: number }).dataIndex]?.url;
    if (url) window.open(url, '_blank', 'noopener');
  },
);
</script>

<template>
  <figure>
    <div ref="el" :style="{ height: `${starsHeight(rows.length)}px` }" role="img" aria-label="Stars per repository"></div>
    <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Primary language">
      <li v-for="l in languages" :key="l"><i class="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" :style="{ background: color(l) }" />{{ l }}</li>
    </ul>
    <figcaption class="mt-1 text-xs text-muted">Stars per repository, coloured by primary language; click a bar to open the repository.</figcaption>
  </figure>
</template>
