import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { groupSchema, projectSchema, researchSchema } from './content/schemas.ts';

export const collections = {
  projects: defineCollection({ loader: file('src/content/projects.yml'), schema: projectSchema }),
  groups: defineCollection({ loader: file('src/content/groups.yml'), schema: groupSchema }),
  research: defineCollection({ loader: file('src/content/research.yml'), schema: researchSchema }),
};
