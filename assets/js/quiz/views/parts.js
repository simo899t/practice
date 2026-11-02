/** Shared chrome used by every question view. */

import { el, icon, ICONS } from '../../core/dom.js';
import { renderContext, richNode } from '../../content/richtext.js';
import { FORMATS } from '../model.js';

/**
 * Sheet header: the paper's own label for the question (falling back to its
 * position in this run) and the answer format. The run counter lives in the
 * top bar, so the two numbers never compete.
 */
export function questionHead(question, index) {
  const label = question.section.trim() || `Question ${index + 1}`;
  return el('div', { class: 'qhead' }, [
    el('span', { class: 'qlabel', text: label }),
    el('span', { class: 'qformat', text: FORMATS[question.format].label }),
  ]);
}

/**
 * Context prose, code listing and prompt, in reading order. Some papers keep
 * the whole question in `context` and leave `text` empty — there the context
 * is the question, so it is set as the prompt instead of as muted preamble.
 */
export function questionBody(card, question, resolve) {
  const prompt = question.text.trim();

  if (question.context.trim()) {
    renderContext(card, question.context, resolve, prompt ? 'qcontext' : 'qtext');
  }
  if (prompt) card.append(richNode('h1', 'qtext', question.text, resolve));

  return card;
}

/**
 * Footer with a left-hand hint and a right-hand primary button.
 * @returns {{node: HTMLElement, button: HTMLButtonElement, setHint: (html: Node|string) => void}}
 */
export function cardFooter({ hint = '', label, onClick, hidden = false }) {
  const hintNode = el('span', { class: 'hint' });
  if (hint) hintNode.append(hint);

  const button = el('button', {
    class: 'btn' + (hidden ? ' hidden' : ''),
    type: 'button',
    on: { click: onClick },
  }, [label, icon(ICONS.arrowRight, { size: 15 })]);

  return {
    node: el('div', { class: 'qfoot' }, [hintNode, button]),
    button,
    setHint(content) {
      hintNode.replaceChildren(content ?? '');
    },
  };
}

/** "<kbd>A</kbd>–<kbd>D</kbd> to answer" */
export function keyHint(keys, trailing, separator = ' ') {
  const node = el('span', { class: 'keys' });
  keys.forEach((key, i) => {
    if (i > 0) node.append(separator);
    node.append(el('kbd', { class: 'key-hint', text: key }));
  });
  node.append(` ${trailing}`);
  return node;
}

/** Small round status mark used once an answer has been graded. */
export function statusIcon(kind) {
  const path = kind === 'good' ? ICONS.check : kind === 'bad' ? ICONS.x : ICONS.minus;
  return icon(path, { size: 16, stroke: 2.4 });
}

/** The note explaining the right answer, when the author wrote one. */
export function noteNode(text, resolve) {
  if (!text || !text.trim()) return null;
  return richNode('span', 'note', text, resolve);
}

export const nextLabel = (isLast) => (isLast ? 'See results' : 'Next question');
