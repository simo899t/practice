/**
 * Test files are Markdown. One file holds one test:
 *
 *   # Exam January 2025                  optional title, used when the test is added
 *
 *   ## Question 1: Propositional logic   every question starts with a ## heading, its label
 *   > Let p and q be propositions.       optional setup, shown above the question
 *
 *   Which of these statements are true?  the question itself
 *
 *   - [ ] A wrong option                 multiple choice: [x] marks the right option
 *   - [x] The right option
 *     > Why it is right.                 a quoted line under an option is its note
 *
 *   - [true] A statement                 true / false: [true] or [false] per statement
 *   - [false] Another one                ([yes]/[no] and [correct]/[incorrect] work too)
 *
 *   ### Answer                           a written answer: the model answer follows
 *
 * A question with neither options nor statements is a written answer, with
 * or without a model answer. Other lines indented under an option continue
 * it. Any text can hold maths, figures, emphasis and code (see richtext.js).
 */

import { IMAGE, closesFence, fenceStart } from '../content/richtext.js';

/** Statement markers, positive first; the marker is also the button label. */
const PAIRS = [
  ['true', 'false'],
  ['yes', 'no'],
  ['correct', 'incorrect'],
];

const TITLE = /^#(?!#)\s*(.*)$/;
const QUESTION = /^##(?!#)\s*(.*)$/;
const ANSWER = /^###\s*(?:model\s+)?answer\s*:?$/i;
const ITEM = /^ {0,3}[-*+][ \t]+\[([^\]]*)\][ \t]?(.*)$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;

const unquote = (line) => line.match(QUOTE)?.[1] ?? line;
const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/** Removes up to `width` columns of indentation (a tab counts as four). */
function dedent(line, width) {
  let column = 0;
  let at = 0;
  while (at < line.length && column < width && (line[at] === ' ' || line[at] === '\t')) {
    column += line[at] === '\t' ? 4 : 1;
    at += 1;
  }
  return line.slice(at);
}

/** Columns of indentation at the start of `line`. */
function indentOf(line) {
  let column = 0;
  for (const char of line) {
    if (char === ' ') column += 1;
    else if (char === '\t') column += 4;
    else break;
  }
  return column;
}

/** The block's text, without blank lines at either end. */
function joined(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end).join('\n');
}

function kindOf(marker) {
  if (marker === '' || marker === 'x') return 'option';
  return PAIRS.some((pair) => pair.includes(marker)) ? 'statement' : null;
}

/**
 * Reads a test file. Questions that cannot work are left out and counted in
 * `skipped`; `issues` explains those and anything else an author should fix,
 * so an empty list means the file is ready.
 * @returns {{
 *   title: string,
 *   questions: Array,
 *   issues: Array<{line: number, message: string}>,
 *   images: Array<{line: number, path: string}>,
 *   skipped: number,
 * }}
 */
export function parseTest(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const issues = [];
  const images = [];
  const blocks = [];
  const report = (line, message) => issues.push({ line, message });

  let title = '';
  let block = null;
  let mode = 'body'; // body | item | after (loose text below the options) | answer
  let fence = null; // the open code block: lines go to it verbatim until it closes
  let stray = false;

  /** Adds a line to a block, noting figures and code blocks that open on it. */
  function add(into, text, at, strip = (line) => line) {
    into.push(text);
    const marker = fenceStart(text);
    if (marker) fence = { marker, into, strip, at };
    else for (const match of text.matchAll(IMAGE)) images.push({ line: at, path: match[2] });
  }

  /** A line under an option: its note (quoted), more of its text (indented), or the end of the list. */
  function continueItem(item, line, at) {
    if (!line.trim()) {
      item.gap = true;
      return;
    }
    if (indentOf(line) < 2) {
      report(at, 'This line is below the options but not indented, so it is ignored. Indent it to keep it with the option above.');
      mode = 'after';
      return;
    }

    item.indent ||= indentOf(line);
    const strip = (text) => dedent(text, item.indent);
    const inner = strip(line);
    const quoted = QUOTE.test(inner);
    const into = quoted ? item.note : item.text;
    if (item.gap && into.length) into.push('');
    item.gap = false;

    if (quoted) add(item.note, unquote(inner), at, (text) => unquote(strip(text)));
    else add(item.text, inner, at, strip);
  }

  lines.forEach((line, index) => {
    const at = index + 1;

    if (fence) {
      const text = fence.strip(line);
      fence.into.push(text);
      if (closesFence(text, fence.marker)) fence = null;
      return;
    }

    const heading = line.match(QUESTION);
    if (heading) {
      block = { at, section: heading[1].trim(), setup: [], prompt: [], items: [], answer: null };
      blocks.push(block);
      mode = 'body';
      return;
    }

    if (!block) {
      const top = line.match(TITLE);
      if (top && !title) title = top[1].trim();
      else if (line.trim() && !stray) {
        stray = true;
        report(at, 'Text before the first question is ignored. Each question starts with a "## " heading.');
      }
      return;
    }

    if (ANSWER.test(line.trim())) {
      block.answer = [];
      block.answerAt = at;
      mode = 'answer';
      return;
    }
    if (mode === 'answer') {
      add(block.answer, line, at);
      return;
    }

    const item = line.match(ITEM);
    if (item) {
      const entry = { at, marker: item[1].trim().toLowerCase(), text: [], note: [], indent: 0, gap: false };
      block.items.push(entry);
      add(entry.text, item[2].trimEnd(), at);
      mode = 'item';
      return;
    }

    if (mode === 'item') continueItem(block.items.at(-1), line, at);
    else if (mode === 'body') {
      if (QUOTE.test(line)) add(block.setup, unquote(line), at, unquote);
      else add(block.prompt, line, at);
    }
  });

  if (fence) report(fence.at, 'This code block is never closed. End it with a line of ```.');
  if (!blocks.length) report(1, 'No questions found. Start each question with a line like "## Question 1".');

  const questions = blocks
    .map((entry, i) => build(entry, i + 1, report))
    .filter(Boolean);

  return {
    title,
    questions,
    issues: issues.sort((a, b) => a.line - b.line),
    images,
    skipped: blocks.length - questions.length,
  };
}

/** One ## block as a question, or null when it cannot work. */
function build(block, n, report) {
  const name = `Question ${n}`;
  const setup = joined(block.setup);
  const prompt = joined(block.prompt);
  // Without a question below it, the setup is the question.
  const base = { id: `q${n}`, section: block.section, context: prompt ? setup : '', text: prompt || setup };

  if (!block.items.length) {
    if (!base.text.trim()) {
      report(block.at, `${name} has no question text.`);
      return null;
    }
    const answer = block.answer ? joined(block.answer) : '';
    return { ...base, format: 'open', answer, hasAnswer: Boolean(answer.trim()) };
  }

  if (block.answer) {
    report(block.answerAt, `${name} has options, so its "### Answer" is ignored. Put explanations in notes under the options.`);
  }

  // Options and statements can carry a question on their own ("## Question 10: True or False").
  const unknown = block.items.filter((item) => !kindOf(item.marker));
  for (const item of unknown) {
    report(item.at, `"[${item.marker}]" is not a marker. Use [ ] and [x] for options, or [true] and [false] for statements.`);
  }
  if (unknown.length) return null;

  const options = block.items.filter((item) => kindOf(item.marker) === 'option');
  if (options.length && options.length < block.items.length) {
    report(block.at, `${name} mixes options ([ ] and [x]) with statements ([true] and [false]).`);
    return null;
  }

  return options.length ? single(base, block, name, report) : group(base, block, name, report);
}

function single(base, block, name, report) {
  const options = block.items.map((item) => ({
    text: joined(item.text),
    correct: item.marker === 'x',
    note: joined(item.note),
  }));
  options.forEach((option, i) => {
    if (!option.text.trim()) report(block.items[i].at, `${name}: this option is empty.`);
  });

  const correct = options.filter((option) => option.correct).length;
  if (options.length < 2) {
    report(block.at, `${name} needs at least two options.`);
    return null;
  }
  if (!correct) {
    report(block.at, `${name} has no option marked [x].`);
    return null;
  }
  if (correct > 1) report(block.at, `${name} has more than one option marked [x].`);

  return { ...base, format: 'single', options };
}

function group(base, block, name, report) {
  const pairs = new Set(block.items.map((item) => PAIRS.findIndex((pair) => pair.includes(item.marker))));
  if (pairs.size > 1) {
    report(block.at, `${name} mixes markers like [true] and [no]. Use one pair per question.`);
    return null;
  }

  const [positive, negative] = PAIRS[[...pairs][0]];
  const statements = block.items.map((item) => ({
    text: joined(item.text),
    answerIsPositive: item.marker === positive,
    note: joined(item.note),
  }));
  statements.forEach((statement, i) => {
    if (!statement.text.trim()) report(block.items[i].at, `${name}: this statement is empty.`);
  });

  return {
    ...base,
    format: 'group',
    positiveLabel: capitalize(positive),
    negativeLabel: capitalize(negative),
    statements,
  };
}
