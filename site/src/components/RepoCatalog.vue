<script setup lang="ts">
import { computed, ref } from 'vue';

interface Repo {
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  stars: number;
  forks: number;
  language: string | null;
  pushedAt: string;
  archived: boolean;
  license: string | null;
}
interface Group { id: string; name: string; description: string; entries: Repo[] }
const props = defineProps<{ groups: Group[] }>();

const query = ref('');
const sort = ref<'name' | 'stars' | 'pushed'>('pushed');
const collapsed = ref<Set<string>>(new Set());
const sorters = {
  name: (a: Repo, b: Repo) => a.name.localeCompare(b.name),
  stars: (a: Repo, b: Repo) => b.stars - a.stars,
  pushed: (a: Repo, b: Repo) => b.pushedAt.localeCompare(a.pushedAt),
};
const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.groups
    .map((g) => ({
      ...g,
      entries: g.entries
        .filter((r) => !q || r.fullName.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q))
        .sort(sorters[sort.value]),
    }))
    .filter((g) => g.entries.length > 0);
});
function toggle(id: string) {
  const s = new Set(collapsed.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  collapsed.value = s;
}
const year = (iso: string) => iso.slice(0, 4);
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <label class="flex items-center gap-2">
        Filter
        <input v-model="query" type="search" placeholder="name or description" class="rounded border border-surface px-2 py-1" />
      </label>
      <label class="flex items-center gap-2">
        Sort by
        <select v-model="sort" class="rounded border border-surface px-2 py-1">
          <option value="pushed">last push</option>
          <option value="stars">stars</option>
          <option value="name">name</option>
        </select>
      </label>
    </div>
    <div v-for="g in visible" :key="g.id" class="mt-8">
      <button class="flex w-full flex-wrap items-baseline gap-x-3 text-left" :aria-expanded="!collapsed.has(g.id)" @click="toggle(g.id)">
        <h3 class="text-xl">{{ g.name }}</h3>
        <span class="text-sm text-muted">{{ g.entries.length }} · {{ g.description }}</span>
        <span class="ml-auto text-muted">{{ collapsed.has(g.id) ? '+' : '−' }}</span>
      </button>
      <ul v-if="!collapsed.has(g.id)" class="mt-3 grid gap-3 md:grid-cols-2">
        <li v-for="r in g.entries" :key="r.fullName" class="rounded border border-surface p-3">
          <div class="flex flex-wrap items-baseline gap-2">
            <a class="font-semibold text-primary hover:text-accent" :href="r.htmlUrl">{{ r.owner }}/<span class="font-bold">{{ r.name }}</span></a>
            <span v-if="r.archived" class="rounded-full bg-surface px-2 text-xs">archived</span>
            <span class="ml-auto text-xs text-muted">★ {{ r.stars }} · {{ r.language ?? '—' }} · {{ year(r.pushedAt) }}</span>
          </div>
          <p v-if="r.description" class="mt-1 text-sm text-ink/80">{{ r.description }}</p>
        </li>
      </ul>
    </div>
    <p v-if="visible.length === 0" class="mt-6 text-ink/70">No repositories match “{{ query }}”.</p>
  </div>
</template>
