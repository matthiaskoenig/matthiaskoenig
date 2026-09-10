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
