import { expect, test } from 'vitest';
import { renderMarkdown } from '../src/lib/markdown.ts';

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
