/**
 * Question text is plain text with a few authoring conveniences:
 *   `$x^2$` / `$$…$$`        — maths, left intact for KaTeX to typeset
 *   `[image: assets/foo.png]` — an inline figure, resolved against the exam file
 *   `*emphasis*`, `**strong**` — light markdown, applied outside maths only
 *   `Code:` followed by a listing — rendered as a monospace block
 * Everything else becomes a text node, so nothing in the data can inject HTML.
 */

import { el } from '../core/dom.js';

const MATH_SPAN = /\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g;
const IMAGE_TOKEN = /\[image:\s*([^\]]+)\]/g;
const EMPHASIS = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
const CODE_SPLIT = /^([\s\S]*?\bCode(?:\s*\([^)]*\))?:)[ \t]*\n?([\s\S]+)$/;

/** Resolves an asset path relative to the exam JSON file it came from. */
export function assetResolver(examFile) {
  const baseDir = examFile.slice(0, examFile.lastIndexOf('/') + 1);
  return (path) => {
    const trimmed = path.trim();
    if (/^(https?:)?\/\//.test(trimmed) || trimmed.startsWith('/')) return trimmed;
    return baseDir + trimmed;
  };
}

/** Walks `input`, handing matches of `pattern` and the text between them to callbacks. */
function eachSegment(input, pattern, { onMatch, onText }) {
  let cursor = 0;
  let match;
  pattern.lastIndex = 0;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > cursor) onText(input.slice(cursor, match.index));
    onMatch(match);
    cursor = pattern.lastIndex;
  }
  if (cursor < input.length) onText(input.slice(cursor));
}

function imageNode(path, resolve) {
  const img = el('img', {
    class: 'inline-image',
    src: resolve ? resolve(path) : path.trim(),
    alt: 'Figure from the test',
    loading: 'lazy',
  });

  // A figure that never made it into the repo should not leave a broken icon.
  img.addEventListener('error', () => {
    img.replaceWith(el('span', { class: 'missing-image', text: 'Figure unavailable' }));
  });
  return img;
}

function renderEmphasis(target, text) {
  eachSegment(text, EMPHASIS, {
    onMatch: (match) =>
      target.append(
        el(match[1] ? 'strong' : 'em', { text: match[1] ?? match[2] })
      ),
    onText: (plain) => target.append(plain),
  });
}

function renderProse(target, text, resolve) {
  eachSegment(text, IMAGE_TOKEN, {
    onMatch: (match) => target.append(imageNode(match[1], resolve)),
    onText: (plain) => renderEmphasis(target, plain),
  });
}

/** Appends `text` to `target`, expanding maths, images, emphasis and newlines. */
export function renderRich(target, text, resolve) {
  const lines = String(text ?? '').split('\n');

  lines.forEach((line, index) => {
    if (index > 0) target.append(el('br'));
    eachSegment(line, MATH_SPAN, {
      onMatch: (match) => target.append(match[0]), // left verbatim for KaTeX
      onText: (plain) => renderProse(target, plain, resolve),
    });
  });

  return target;
}

/** Convenience: a fresh element containing the rich text. */
export function richNode(tag, className, text, resolve) {
  return renderRich(el(tag, { class: className }), text, resolve);
}

/**
 * Splits a context string into prose and an optional trailing code listing, so
 * indentation survives instead of being reflowed by the prose styles.
 * @returns {{prose: string, code: string|null}}
 */
export function splitCode(context) {
  const text = String(context ?? '');
  const match = text.match(CODE_SPLIT);
  if (!match) return { prose: text, code: null };
  return { prose: match[1], code: match[2] };
}

/**
 * Renders a context block (prose + optional code) into `target`.
 * `className` lets a paper that keeps the whole question in `context` present
 * it as the prompt rather than as muted supporting text.
 */
export function renderContext(target, context, resolve, className = 'qcontext') {
  const { prose, code } = splitCode(context);
  if (prose.trim()) target.append(richNode('div', className, prose, resolve));
  if (code !== null) target.append(el('pre', { class: 'codeblock', text: code }));
  return target;
}

/** Strips markup and newlines — for compact summaries and review lists. */
export function plainText(text) {
  return String(text ?? '')
    .replace(IMAGE_TOKEN, ' ')
    .replace(EMPHASIS, (_, strong, emphasis) => strong ?? emphasis)
    .replace(/\s+/g, ' ')
    .trim();
}
