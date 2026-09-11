// Inline glyphs matching the Font Awesome 4 icons used on livermetabolism.com
// (fa-cube, fa-heartbeat, fa-picture-o, fa-line-chart, fa-unlock-alt), 24x24 viewBox.
import type { iconNames } from '../content/schemas.ts';

export const iconPaths: Record<(typeof iconNames)[number], string> = {
  cube: 'M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.2 6.4 3.2L12 10.6 5.6 7.4 12 4.2ZM5 9.1l6 3v7.4l-6-3V9.1Zm14 0v7.4l-6 3v-7.4l6-3Z',
  heartbeat: 'M12 21S4.5 16.4 2.4 11.6C1 8.3 3.2 4.5 6.9 4.5c2 0 3.6 1.1 5.1 2.8 1.5-1.7 3.1-2.8 5.1-2.8 3.7 0 5.9 3.8 4.5 7.1C19.5 16.4 12 21 12 21ZM5 12h3.2l1.6-2.5 2.4 5 1.8-3.5H19v-1.6h-5.9l-.9 1.7-2.4-5L8.3 10.4H5V12Z',
  picture: 'M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v9.5l4.5-4.5 4 4 3-3 4.5 4.5V6H4Zm12 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
  'line-chart': 'M3 3h2v16h16v2H3V3Zm4 12 4-5 3 3 6-7 1.5 1.3-7.5 8.7-3-3-2.5 3.2L7 15Z',
  unlock: 'M12 2a5 5 0 0 1 5 5v1h-2V7a3 3 0 0 0-6 0v3h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5Zm0 12a1.5 1.5 0 0 0-.8 2.8V19h1.6v-2.2A1.5 1.5 0 0 0 12 14Z',
};

/** A topic icon as a standalone SVG file: coloured disc with the white glyph. */
export function topicIconSvg(icon: keyof typeof iconPaths, color: string, size = 40): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">` +
    `<circle cx="20" cy="20" r="20" fill="${color}"/>` +
    `<g transform="translate(8 8)"><path d="${iconPaths[icon]}" fill="#fff"/></g></svg>`
  );
}
