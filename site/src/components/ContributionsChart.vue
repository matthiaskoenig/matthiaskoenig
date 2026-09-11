<script setup lang="ts">
import { useChart } from './useChart.ts';
import { contributionsOption } from '../lib/chart-options.ts';
const props = defineProps<{ months: { month: string; count: number }[] }>();
const el = useChart(() => contributionsOption(props.months));
</script>

<template>
  <figure>
    <div ref="el" class="h-56" role="img" aria-label="Contributions per month"></div>
    <figcaption class="mt-1 text-xs text-muted">Contributions per month over the last year.</figcaption>
  </figure>
</template>
