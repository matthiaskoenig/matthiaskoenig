// Which logo file belongs to which repository. Pure (no Vite/Astro), shared by
// the site (src/lib/logos.ts) and the README renderer.
import type { Project } from '../content/schemas.ts';

export interface LogoRef { folder: 'projects' | 'logos'; file: string }

/**
 * Main projects use `image` from projects.yml (src/assets/projects/); any other
 * repository gets src/assets/logos/<repo name>.<ext> when such a file exists.
 */
export function logoFor(fullName: string, projects: Project[], logoFiles: string[]): LogoRef | null {
  const project = projects.find((p) => p.repo === fullName);
  if (project?.image) return { folder: 'projects', file: project.image };
  const name = fullName.split('/')[1];
  const file = logoFiles.find((f) => f.replace(/\.[a-z0-9]+$/i, '') === name);
  return file ? { folder: 'logos', file } : null;
}
