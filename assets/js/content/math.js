/** KaTeX glue: the library is loaded async from a CDN, so typesetting waits. */

const DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
];

const pending = new Set();
let watching = false;

function typeset(node) {
  if (!window.renderMathInElement) return false;
  window.renderMathInElement(node, { delimiters: DELIMITERS, throwOnError: false });
  return true;
}

function watch() {
  if (watching) return;
  watching = true;
  const timer = setInterval(() => {
    if (!window.renderMathInElement) return;
    clearInterval(timer);
    watching = false;
    for (const node of pending) typeset(node);
    pending.clear();
  }, 40);
}

/** Typesets `node` now, or as soon as KaTeX has finished loading. */
export function renderMath(node) {
  if (!node) return;
  if (!typeset(node)) {
    pending.add(node);
    watch();
  }
}
