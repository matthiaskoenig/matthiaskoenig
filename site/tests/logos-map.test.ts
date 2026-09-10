import { expect, test } from 'vitest';
import { logoFor } from '../src/lib/logos-map.ts';

const projects = [{ id: 'pkdb', order: 1, name: 'PK-DB', repo: 'matthiaskoenig/pkdb', title: '', description: '', tags: [], image: 'pkdb.webp' }];
const files = ['tellurium.webp', 'roadrunner.webp'];

test('main projects use their projects.yml image', () => {
  expect(logoFor('matthiaskoenig/pkdb', projects, files)).toEqual({ folder: 'projects', file: 'pkdb.webp' });
});
test('other repositories match a file in src/assets/logos by repo name', () => {
  expect(logoFor('sys-bio/roadrunner', projects, files)).toEqual({ folder: 'logos', file: 'roadrunner.webp' });
  expect(logoFor('opencobra/cobrapy', projects, files)).toBeNull();
});
