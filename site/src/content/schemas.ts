import { z } from 'astro/zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';

export const repoRef = z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'expected owner/name');

export const projectSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  name: z.string(),
  repo: repoRef,
  title: z.string(),
  description: z.string(),
  homepage: z.url().optional(),
  docs: z.url().optional(),
  doi: z.string().optional(),
  image: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const groupSchema = z
  .object({
    id: z.string(),
    order: z.number().int().positive(),
    name: z.string(),
    description: z.string(),
    repos: z.array(repoRef).min(1),
    /** Repositories of this group left out of the charts (release timeline, stars); must be listed in `repos`. */
    charts_exclude: z.array(repoRef).default([]),
  })
  .refine((g) => g.charts_exclude.every((r) => g.repos.includes(r)), { message: 'charts_exclude must only name repos of the same group' });

export const iconNames = ['cube', 'heartbeat', 'picture', 'line-chart', 'unlock'] as const;

export const researchSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  tag: z.string(),
  name: z.string(),
  icon: z.enum(iconNames),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a hex colour like #3498db'),
  description: z.string(),
  link: z.url(),
});

export type Project = z.infer<typeof projectSchema>;
export type Group = z.infer<typeof groupSchema>;
export type Research = z.infer<typeof researchSchema>;

function loadList<T>(path: string, schema: z.ZodType<T>): T[] {
  const raw = loadYaml(readFileSync(path, 'utf8'));
  return z.array(schema).parse(raw);
}

/** Loads and validates the three curated YAML files in `dir`. */
export function loadCuratedYaml(dir: string) {
  return {
    projects: loadList(join(dir, 'projects.yml'), projectSchema),
    groups: loadList(join(dir, 'groups.yml'), groupSchema),
    research: loadList(join(dir, 'research.yml'), researchSchema),
  };
}
