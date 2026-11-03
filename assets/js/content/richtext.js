/**
 * Text in a test file is Markdown-flavoured plain text:
 *   `$x^2$` / `$$…$$`            — maths, left intact for KaTeX to typeset
 *   `![alt](assets/figure.png)`  — a figure, resolved against the test file
 *   `*emphasis*`, `**strong**`   — applied outside maths only
 *   ``` fenced blocks ```        — code listings, kept exactly as written
 * Line breaks are kept as written. Everything else becomes a text node, so
 * nothing in a test file can inject HTML.
 */

import { el } from '../core/dom.js';

const MATH_SPAN = /\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g;
export const IMAGE = /!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)/g;
const EMPHASIS = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** The marker when `line` opens a fenced code block (``` or ~~~), else null. */
export function fenceStart(line) {
  return line.match(FENCE)?.[1] ?? null;
}

/** Whether `line` closes the block opened by `marker`. */
export function closesFence(line, marker) {
  const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/)?.[1];
  return Boolean(close) && close[0] === marker[0] && close.length >= marker.length;
}

/**
 * Splits text into prose and code listings, in order. An unclosed fence runs
 * to the end, as in Markdown.
 * @returns {Array<{prose: string} | {code: string}>}
 */
export function splitBlocks(text) {
  const blocks = [];
  let prose = [];
  let code = null;

  const flush = () => {
    const kept = prose.join('\n').replace(/^\n+|\n+$/g, '');
    if (kept.trim()) blocks.push({ prose: kept });
    prose = [];
  };

  for (const line of String(text ?? '').split('\n')) {
    if (code) {
      if (closesFence(line, code.marker)) {
        blocks.push({ code: code.lines.join('\n') });
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }

    const marker = fenceStart(line);
    if (marker) {
      flush();
      code = { marker, lines: [] };
    } else {
      prose.push(line);
    }
  }

  if (code) blocks.push({ code: code.lines.join('\n') });
  flush();
  return blocks;
}

/** Resolves an asset path relative to the test file it came from. */
export function assetResolver(testFile) {
  const baseDir = testFile.slice(0, testFile.lastIndexOf('/') + 1);
  return (path) => {
    const trimmed = path.trim();
    // https:, blob:, data:, //host and /root paths are already complete
    if (/^(?:[a-z]+:|\/)/i.test(trimmed)) return trimmed;
    return baseDir + trimmed.replace(/^\.\//, '');
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

function imageNode(alt, path, resolve) {
  const img = el('img', {
    class: 'inline-image',
    src: resolve ? resolve(path) : path.trim(),
    alt: alt.trim() || 'Figure from the test',
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
  eachSegment(text, IMAGE, {
    onMatch: (match) => target.append(imageNode(match[1], match[2], resolve)),
    onText: (plain) => renderEmphasis(target, plain),
  });
}

function renderLines(target, text, resolve) {
  text.split('\n').forEach((line, index) => {
    if (index > 0) target.append(el('br'));
    eachSegment(line, MATH_SPAN, {
      onMatch: (match) => target.append(match[0]), // left verbatim for KaTeX
      onText: (plain) => renderProse(target, plain, resolve),
    });
  });
}

/** Appends `text` to `target`: prose with maths, figures, emphasis and line breaks, then any listings. */
export function renderRich(target, text, resolve) {
  for (const block of splitBlocks(text)) {
    if ('code' in block) target.append(el('pre', { class: 'codeblock', text: block.code }));
    else renderLines(target, block.prose, resolve);
  }
  return target;
}

/** Convenience: a fresh element containing the rich text. */
export function richNode(tag, className, text, resolve) {
  return renderRich(el(tag, { class: className }), text, resolve);
}

/** Strips markup, listings and newlines — for compact summaries and review lists. */
export function plainText(text) {
  return splitBlocks(text)
    .filter((block) => 'prose' in block)
    .map((block) => block.prose)
    .join(' ')
    .replace(IMAGE, ' ')
    .replace(EMPHASIS, (_, strong, emphasis) => strong ?? emphasis)
    .replace(/\s+/g, ' ')
    .trim();
}
