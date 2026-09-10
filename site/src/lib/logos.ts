// Resolves repository logos to optimised image URLs at build time.
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { Project } from '../content/schemas.ts';
import { logoFor } from './logos-map.ts';

const projectFiles = import.meta.glob<{ default: ImageMetadata }>('../assets/projects/*.{png,webp,svg,jpg}', { eager: true });
const logoFiles = import.meta.glob<{ default: ImageMetadata }>('../assets/logos/*.{png,webp,svg,jpg}', { eager: true });
const logoNames = Object.keys(logoFiles).map((k) => k.split('/').pop()!);

/** Map from `owner/name` to a small (48px high) logo URL for every repo that has one. */
export async function logoUrls(fullNames: string[], projects: Project[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const fullName of fullNames) {
    const ref = logoFor(fullName, projects, logoNames);
    if (!ref) continue;
    const meta = (ref.folder === 'projects' ? projectFiles[`../assets/projects/${ref.file}`] : logoFiles[`../assets/logos/${ref.file}`])?.default;
    if (!meta) throw new Error(`Logo ${ref.folder}/${ref.file} for ${fullName} not found`);
    out[fullName] = (await getImage({ src: meta, height: 48 })).src;
  }
  return out;
}
