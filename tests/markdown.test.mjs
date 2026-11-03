import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { parseTest } from '../assets/js/quiz/markdown.js';

const lines = (...rows) => rows.join('\n');

/* ── Reading the three formats ─────────────────────────────────────────── */

test('reads a title and one question of each format', () => {
  const { title, questions, issues, skipped } = parseTest(lines(
    '# Exam June 2025',
    '',
    '## Question 1',
    'Which is a hash table?',
    '',
    '- [ ] A list',
    '- [x] A dict',
    '  > Hashing finds the bucket.',
    '',
    '## Question 2: Logic',
    'Which are true?',
    '',
    '- [true] $p \\lor \\neg p$',
    '- [false] $p \\land \\neg p$',
    '  > Never true.',
    '',
    '## Question 3',
    'Explain why.',
    '',
    '### Answer',
    'Because.',
  ));

  assert.equal(title, 'Exam June 2025');
  assert.deepEqual(issues, []);
  assert.equal(skipped, 0);
  assert.deepEqual(questions, [
    {
      id: 'q1',
      section: 'Question 1',
      context: '',
      text: 'Which is a hash table?',
      format: 'single',
      options: [
        { text: 'A list', correct: false, note: '' },
        { text: 'A dict', correct: true, note: 'Hashing finds the bucket.' },
      ],
    },
    {
      id: 'q2',
      section: 'Question 2: Logic',
      context: '',
      text: 'Which are true?',
      format: 'group',
      positiveLabel: 'True',
      negativeLabel: 'False',
      statements: [
        { text: '$p \\lor \\neg p$', answerIsPositive: true, note: '' },
        { text: '$p \\land \\neg p$', answerIsPositive: false, note: 'Never true.' },
      ],
    },
    {
      id: 'q3',
      section: 'Question 3',
      context: '',
      text: 'Explain why.',
      format: 'open',
      answer: 'Because.',
      hasAnswer: true,
    },
  ]);
});

test('a quoted setup sits above the question; on its own it is the question', () => {
  const { questions } = parseTest(lines(
    '## A',
    '> Let $f(x) = x^2$.',
    '>',
    '> It is smooth.',
    '',
    'Find $f\'(x)$.',
    '',
    '## B',
    '> Only a setup.',
  ));
  assert.equal(questions[0].context, 'Let $f(x) = x^2$.\n\nIt is smooth.');
  assert.equal(questions[0].text, "Find $f'(x)$.");
  assert.equal(questions[1].context, '');
  assert.equal(questions[1].text, 'Only a setup.');
});

test('keeps line breaks, and blank lines inside a question', () => {
  const { questions } = parseTest(lines('## Q', '(a) One', '', '(b) Two', '', '', ''));
  assert.equal(questions[0].text, '(a) One\n\n(b) Two');
});

test('indented lines continue an option; quoted ones are its note', () => {
  const { questions } = parseTest(lines(
    '## Q',
    '- [true] Line one',
    '  line two',
    '',
    '  line four',
    '  > The note.',
    '- [false] Next',
  ));
  assert.deepEqual(questions[0].statements[0], {
    text: 'Line one\nline two\n\nline four',
    answerIsPositive: true,
    note: 'The note.',
  });
});

test('other marker pairs become the button labels', () => {
  const yes = parseTest(lines('## Q', '- [yes] a', '- [no] b')).questions[0];
  assert.deepEqual([yes.positiveLabel, yes.negativeLabel], ['Yes', 'No']);
  const correct = parseTest(lines('## Q', '- [Correct] a', '- [INCORRECT] b')).questions[0];
  assert.deepEqual([correct.positiveLabel, correct.negativeLabel], ['Correct', 'Incorrect']);
  assert.deepEqual(correct.statements.map((s) => s.answerIsPositive), [true, false]);
});

test('a question can be all heading and statements', () => {
  const { questions, issues } = parseTest(lines('## Question 10: True or False', '- [true] a', '- [false] b'));
  assert.deepEqual(issues, []);
  assert.equal(questions[0].text, '');
});

test('a written answer without a model answer still loads', () => {
  const { questions } = parseTest(lines('## Q', 'Prove it.'));
  assert.equal(questions[0].format, 'open');
  assert.equal(questions[0].hasAnswer, false);
  assert.equal(questions[0].answer, '');
});

test('code blocks are copied verbatim, headings and markers inside them included', () => {
  const { questions, issues } = parseTest(lines(
    '## Q',
    '> Code:',
    '> ```',
    '> ## not a question',
    '>     - [x] not an option',
    '> ```',
    '',
    'What does it print?',
    '',
    '### Answer',
    '```',
    '## still the answer',
    '```',
  ));
  assert.deepEqual(issues, []);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].context, 'Code:\n```\n## not a question\n    - [x] not an option\n```');
  assert.equal(questions[0].answer, '```\n## still the answer\n```');
});

test('lists the figures it uses, with their lines', () => {
  const { images } = parseTest(lines(
    '## Q',
    '![Graph](assets/graph.png)',
    '- [x] ![](assets/a.png)',
    '- [ ] b',
    '  > See ![](assets/note.png)',
  ));
  assert.deepEqual(images, [
    { line: 2, path: 'assets/graph.png' },
    { line: 3, path: 'assets/a.png' },
    { line: 5, path: 'assets/note.png' },
  ]);
});

test('reads Windows line endings', () => {
  const { questions } = parseTest('## Q\r\nWhy?\r\n');
  assert.equal(questions[0].text, 'Why?');
});

/* ── Telling authors what to fix ───────────────────────────────────────── */

const messages = (source) => parseTest(source).issues.map((issue) => `${issue.line}: ${issue.message}`);

test('an empty file, or one without headings, has no questions', () => {
  assert.deepEqual(messages(''), ['1: No questions found. Start each question with a line like "## Question 1".']);
  assert.deepEqual(messages('Just text'), [
    '1: Text before the first question is ignored. Each question starts with a "## " heading.',
    '1: No questions found. Start each question with a line like "## Question 1".',
  ]);
});

test('questions that cannot work are left out and explained', () => {
  const result = parseTest(lines(
    '## One',                // 1
    '- [ ] a',
    '- [ ] b',
    '## Two',                // 4
    '- [x] only',
    '## Three',              // 6
    '- [maybe] a',
    '## Four',               // 8
    '- [x] a',
    '- [true] b',
    '## Five',               // 11
    '- [true] a',
    '- [no] b',
    '## Six',                // 14
    '',
    '## Seven',              // 16
    'Fine?',
    '- [x] yes',
    '- [ ] no',
  ));

  assert.equal(result.skipped, 6);
  assert.deepEqual(result.questions.map((q) => q.section), ['Seven']);
  assert.deepEqual(result.issues.map((issue) => `${issue.line}: ${issue.message}`), [
    '1: Question 1 has no option marked [x].',
    '4: Question 2 needs at least two options.',
    '7: "[maybe]" is not a marker. Use [ ] and [x] for options, or [true] and [false] for statements.',
    '8: Question 4 mixes options ([ ] and [x]) with statements ([true] and [false]).',
    '11: Question 5 mixes markers like [true] and [no]. Use one pair per question.',
    '14: Question 6 has no question text.',
  ]);
});

test('smaller slips are reported but the question still loads', () => {
  const result = parseTest(lines(
    'Intro text',            // 1
    '## Q',                  // 2
    'Pick',
    '- [x] a',               // 4
    '- [x] b',
    '- [ ]',                 // 6
    'Loose text',            // 7
    '### Answer',            // 8
    'Ignored.',
  ));

  assert.equal(result.questions.length, 1);
  assert.deepEqual(result.issues.map((issue) => `${issue.line}: ${issue.message}`), [
    '1: Text before the first question is ignored. Each question starts with a "## " heading.',
    '2: Question 1 has more than one option marked [x].',
    '6: Question 1: this option is empty.',
    '7: This line is below the options but not indented, so it is ignored. Indent it to keep it with the option above.',
    '8: Question 1 has options, so its "### Answer" is ignored. Put explanations in notes under the options.',
  ]);
});

test('an unclosed code block is pointed out', () => {
  const result = parseTest(lines('## Q', 'Look:', '```', 'code', '## swallowed'));
  assert.deepEqual(result.issues, [{ line: 3, message: 'This code block is never closed. End it with a line of ```.' }]);
  assert.equal(result.questions.length, 1);
});
