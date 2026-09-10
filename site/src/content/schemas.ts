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
  tags: z.array(z.string()).default([]),
});

export const groupSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  repos: z.array(repoRef).min(1),
});

export const researchSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  name: z.string(),
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
