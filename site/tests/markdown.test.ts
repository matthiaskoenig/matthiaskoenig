import { describe, expect, test } from 'vitest';
import { renderMarkdown, summarizeMarkdown } from '../src/lib/markdown.ts';

test('renders GFM lists and links', () => {
  const html = renderMarkdown('## Changes\n- item [x](https://e.com)\n');
  expect(html).toContain('<h2');
  expect(html).toContain('<li>');
  expect(html).toContain('href="https://e.com"');
});
test('strips scripts and event handlers', () => {
  const html = renderMarkdown('<script>alert(1)</script><a href="#" onclick="x()">a</a>');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('onclick');
});

describe('summarizeMarkdown', () => {
  test('skips headings, images and the boilerplate lead-in, joins list items', () => {
    const md = '# Release notes for pkdb 0.9.8\r\n\r\n- updated code licensing to MIT\r\n- removed travis\r\n- uv installation\r\n';
    expect(summarizeMarkdown(md)).toBe('updated code licensing to MIT · removed travis · uv installation');
  });
  test('drops the "we are pleased" paragraph and inline markup, keeps the first real content', () => {
    const md = '# Release notes for x 1.0\n![x](logo.png)\n\nWe are pleased to release the next version of x including the\nfollowing changes:\n\n## Features\n- `EntryForm` **added** with [docs](https://e.com)\n- second\n';
    expect(summarizeMarkdown(md)).toBe('EntryForm added with docs · second');
  });
  test('cuts at a word boundary with an ellipsis', () => {
    const md = 'A '.repeat(40) + 'word ' + 'B '.repeat(200);
    const s = summarizeMarkdown(md, 60);
    expect(s.length).toBeLessThanOrEqual(61);
    expect(s.endsWith('…')).toBe(true);
    expect(s).not.toMatch(/ …$/);
  });
  test('drops the team sign-off', () => {
    expect(summarizeMarkdown('- first working prototype\n\nYour visfem team\n')).toBe('first working prototype');
  });
  test('empty body gives an empty summary', () => {
    expect(summarizeMarkdown('')).toBe('');
  });
});
