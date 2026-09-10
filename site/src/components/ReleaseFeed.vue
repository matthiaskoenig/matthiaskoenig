<script setup lang="ts">
import { computed, ref } from 'vue';

interface Release {
  repo: string;
  tag: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  bodyHtml: string;
  prerelease: boolean;
  projectId: string;
  projectName: string;
}
const props = defineProps<{ releases: Release[]; projects: { id: string; name: string }[] }>();

const active = ref<string | null>(null);
const open = ref<Set<string>>(new Set());
const shown = computed(() => (active.value ? props.releases.filter((r) => r.projectId === active.value) : props.releases));
const key = (r: Release) => `${r.repo}@${r.tag}`;
function toggle(r: Release) {
  const k = key(r);
  const s = new Set(open.value);
  if (s.has(k)) s.delete(k);
  else s.add(k);
  open.value = s;
}
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
const chip = (isActive: boolean) => (isActive ? 'bg-primary text-white border-primary' : 'border-surface hover:border-accent');
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-2 text-sm" role="group" aria-label="Filter releases by project">
      <button class="rounded-full border px-3 py-1" :class="chip(active === null)" @click="active = null">All</button>
      <button v-for="p in projects" :key="p.id" class="rounded-full border px-3 py-1" :class="chip(active === p.id)" @click="active = p.id">
        {{ p.name }}
      </button>
    </div>
    <ol class="mt-6 divide-y divide-surface">
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
        <div v-if="open.has(key(r))" class="prose mt-3 rounded bg-surface/60 p-4 text-sm" v-html="r.bodyHtml" />
      </li>
    </ol>
    <p v-if="shown.length === 0" class="text-ink/70">No releases recorded for this project.</p>
  </div>
</template>
