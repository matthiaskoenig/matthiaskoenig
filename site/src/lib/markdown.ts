import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/** Renders GitHub-flavoured markdown (release notes) to sanitised HTML at build time. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { gfm: true, async: false }) as string;
  return sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'strong', 'em', 'blockquote', 'img', 'br', 'hr', 'del', 'input'],
    allowedAttributes: { a: ['href'], img: ['src', 'alt'], input: ['type', 'checked', 'disabled'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

// Lead-in and sign-off lines of the standard release-notes template.
const BOILERPLATE = /we are pleased to (release|announce)|^your \S+ team$/i;

function plainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A one-line plain-text summary of release notes: headings, images and the
 * "we are pleased to release ..." lead-in are skipped; paragraphs and list
 * items are joined with " · " and cut at a word boundary after `max` chars.
 */
export function summarizeMarkdown(md: string, max = 180): string {
  const parts: string[] = [];
  let length = 0;
  for (const token of marked.lexer(md.replace(/\r\n/g, '\n'), { gfm: true })) {
    if (token.type === 'heading' || token.type === 'space' || token.type === 'html' || token.type === 'hr') continue;
    const texts: string[] = [];
    if (token.type === 'list') {
      for (const item of token.items) texts.push(plainText(marked.parser(item.tokens, { async: false }) as string));
    } else {
      texts.push(plainText(marked.parser([token], { async: false }) as string));
    }
    for (const t of texts) {
      if (!t || BOILERPLATE.test(t)) continue;
      parts.push(t);
      length += t.length + 3;
      if (length > max) break;
    }
    if (length > max) break;
  }
  const joined = parts.join(' · ');
  if (joined.length <= max) return joined;
  const cut = joined.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s·,;:]+$/, '') + '…';
}
