import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { normalizeExam } from '../assets/js/quiz/model.js';
import {
  advance,
  answeredCount,
  buildRun,
  createSession,
  currentQuestion,
  gradeGroup,
  gradeOpen,
  gradeSingle,
  isLastQuestion,
  missedQuestions,
  respond,
  scoreSession,
  shuffled,
} from '../assets/js/quiz/session.js';

/** Deterministic rng so shuffles are reproducible in tests. */
function seeded(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const exam = [
  {
    type: 'single',
    section: 'A',
    text: 'Pick b',
    options: [
      { text: 'a', correct: false },
      { text: 'b', correct: true },
      { text: 'c', correct: false },
    ],
  },
  {
    type: 'group',
    section: 'B',
    positiveLabel: 'True',
    negativeLabel: 'False',
    statements: [
      { text: 's1', answerIsPositive: true },
      { text: 's2', answerIsPositive: false },
      { text: 's3', answerIsPositive: true },
    ],
  },
  { type: 'open', section: 'A', text: 'Explain', answer: 'Because.' },
];

const questions = normalizeExam(exam).questions;

/* ── Shuffling ─────────────────────────────────────────────────────────── */

test('shuffled returns a new array and leaves the original alone', () => {
  const input = [1, 2, 3, 4, 5];
  const output = shuffled(input, seeded());
  assert.notEqual(output, input);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
  assert.deepEqual([...output].sort(), input);
});

test('buildRun can keep the original order and contents', () => {
  const run = buildRun(questions, { shuffleQuestions: false, shuffleOptions: false });
  assert.deepEqual(run.map((q) => q.id), questions.map((q) => q.id));
  assert.equal(run[0].options, questions[0].options);
});

test('buildRun limits the run without mutating the pool', () => {
  const run = buildRun(questions, { limit: 2, shuffleQuestions: false, shuffleOptions: false });
  assert.equal(run.length, 2);
  assert.equal(questions.length, 3);
});

test('buildRun shuffles options into fresh question objects', () => {
  const run = buildRun(questions, { shuffleQuestions: false, rng: seeded(7) });
  assert.notEqual(run[0], questions[0]);
  assert.deepEqual(
    [...run[0].options].map((o) => o.text).sort(),
    ['a', 'b', 'c']
  );
  assert.deepEqual(questions[0].options.map((o) => o.text), ['a', 'b', 'c']);
});

/* ── Grading ───────────────────────────────────────────────────────────── */

test('grades a multiple-choice answer', () => {
  assert.equal(gradeSingle(questions[0], 1).earned, 1);
  assert.equal(gradeSingle(questions[0], 0).earned, 0);
  assert.equal(gradeSingle(questions[0], 0).correctIndex, 1);
});

test('grades a group one point per statement', () => {
  const grade = gradeGroup(questions[1], [true, false, true]);
  assert.equal(grade.earned, 3);
  assert.equal(grade.possible, 3);
});

test('counts unanswered statements as wrong, not as silently correct', () => {
  const grade = gradeGroup(questions[1], [true, null, null]);
  assert.equal(grade.earned, 1);
  assert.deepEqual(grade.statements.map((s) => s.correct), [true, false, false]);
  assert.equal(grade.statements[1].given, null);
});

test('grades an open question from the self-assessment', () => {
  assert.equal(gradeOpen(questions[2], { selfRated: true }).earned, 1);
  assert.equal(gradeOpen(questions[2], { selfRated: false }).earned, 0);
  assert.equal(gradeOpen(questions[2], {}).earned, 0);
});

/* ── Session flow ──────────────────────────────────────────────────────── */

test('a new session starts unanswered at the first question', () => {
  const session = createSession({ questions });
  assert.equal(session.index, 0);
  assert.equal(answeredCount(session), 0);
  assert.equal(currentQuestion(session).id, questions[0].id);
  assert.equal(session.finishedAt, null);
});

test('respond and advance never mutate the previous session', () => {
  const first = createSession({ questions });
  const answered = respond(first, gradeSingle(questions[0], 1));
  const moved = advance(answered);

  assert.equal(answeredCount(first), 0);
  assert.equal(first.index, 0);
  assert.equal(answeredCount(answered), 1);
  assert.equal(moved.index, 1);
  assert.notEqual(first.responses, answered.responses);
});

test('advancing past the last question finishes the run', () => {
  let session = createSession({ questions: [questions[0]] });
  assert.ok(isLastQuestion(session));
  session = advance(session, 1234);
  assert.equal(session.finishedAt, 1234);
});

/* ── Scoring ───────────────────────────────────────────────────────────── */

test('scores a full run, grouped by section', () => {
  let session = createSession({ questions });
  session = respond(session, gradeSingle(questions[0], 1));
  session = advance(session);
  session = respond(session, gradeGroup(questions[1], [true, true, true]));
  session = advance(session);
  session = respond(session, gradeOpen(questions[2], { selfRated: false }));

  const score = scoreSession(session);
  assert.equal(score.possible, 5);
  assert.equal(score.earned, 3);
  assert.deepEqual(score.bySection, [
    { section: 'A', earned: 1, possible: 2 },
    { section: 'B', earned: 2, possible: 3 },
  ]);
});

test('unanswered questions count as missed, not as skipped points', () => {
  const session = createSession({ questions });
  const score = scoreSession(session);
  assert.equal(score.earned, 0);
  assert.equal(score.possible, 5);
  assert.equal(score.missed.length, 3);
});

test('missedQuestions feeds a focused retry', () => {
  let session = createSession({ questions });
  session = respond(session, gradeSingle(questions[0], 1));
  session = advance(session);
  session = respond(session, gradeGroup(questions[1], [false, false, false]));

  const missed = missedQuestions(session);
  assert.deepEqual(missed.map((q) => q.id), [questions[1].id, questions[2].id]);
});
