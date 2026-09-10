<script setup lang="ts">
import { computed, ref } from 'vue';

interface Release {
  repo: string;
  tag: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  bodyHtml: string;
  summary: string;
  prerelease: boolean;
  projectId: string;
  projectName: string;
}
const props = defineProps<{ releases: Release[] }>();

const open = ref<Set<string>>(new Set());
const shown = computed(() => props.releases);
const key = (r: Release) => `${r.repo}@${r.tag}`;
function toggle(r: Release) {
  const k = key(r);
  const s = new Set(open.value);
  if (s.has(k)) s.delete(k);
  else s.add(k);
  open.value = s;
}
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
</script>

<template>
  <div>
    <ol class="divide-y divide-surface">
      <li v-for="r in shown" :key="key(r)" class="py-4">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="font-brand font-bold text-primary">{{ r.projectName }}</span>
          <a class="text-accent underline" :href="r.htmlUrl">{{ r.name }}</a>
          <span v-if="r.prerelease" class="rounded-full bg-warning/20 px-2 text-xs">pre-release</span>
          <time class="text-sm text-muted" :datetime="r.publishedAt">{{ fmt(r.publishedAt) }}</time>
          <button v-if="r.bodyHtml" class="ml-auto text-sm text-accent underline" :aria-expanded="open.has(key(r))" @click="toggle(r)">
            {{ open.has(key(r)) ? 'Hide notes' : 'Release notes' }}
          </button>
        </div>
        <p v-if="r.summary && !open.has(key(r))" class="mt-1 text-sm text-ink/70">{{ r.summary }}</p>
        <div v-if="open.has(key(r))" class="prose mt-3 rounded bg-surface/60 p-4 text-sm" v-html="r.bodyHtml" />
      </li>
    </ol>
    <p v-if="shown.length === 0" class="text-ink/70">No releases recorded.</p>
  </div>
</template>
