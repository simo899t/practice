/**
 * Quiz session state and grading — pure functions over plain data.
 * Every operation returns a new session; nothing is mutated in place.
 */

import { questionPoints, sectionOf } from './model.js';

/** Fisher-Yates on a copy. */
export function shuffled(items, rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks the questions for one run.
 * @param {Array} questions
 * @param {{shuffleQuestions?: boolean, shuffleOptions?: boolean, limit?: number|null, rng?: () => number}} options
 */
export function buildRun(questions, options = {}) {
  const {
    shuffleQuestions = true,
    shuffleOptions = true,
    limit = null,
    rng = Math.random,
  } = options;

  const ordered = shuffleQuestions ? shuffled(questions, rng) : [...questions];
  const limited = limit && limit > 0 ? ordered.slice(0, limit) : ordered;

  if (!shuffleOptions) return limited;

  return limited.map((question) => {
    if (question.format === 'single') {
      return { ...question, options: shuffled(question.options, rng) };
    }
    if (question.format === 'group') {
      return { ...question, statements: shuffled(question.statements, rng) };
    }
    return question;
  });
}

export function createSession({ questions, startedAt = Date.now() }) {
  return {
    questions,
    index: 0,
    responses: questions.map(() => null),
    startedAt,
    finishedAt: null,
  };
}

export const currentQuestion = (session) => session.questions[session.index] ?? null;
export const currentResponse = (session) => session.responses[session.index] ?? null;
export const isLastQuestion = (session) => session.index >= session.questions.length - 1;
export const answeredCount = (session) =>
  session.responses.filter((response) => response !== null).length;

/** Stores a response for the current question. */
export function respond(session, response) {
  const responses = session.responses.map((existing, i) =>
    i === session.index ? response : existing
  );
  return { ...session, responses };
}

/** Moves to the next question, or finishes the run. */
export function advance(session, now = Date.now()) {
  if (isLastQuestion(session)) return { ...session, finishedAt: now };
  return { ...session, index: session.index + 1 };
}

/** Finishes the run early; whatever is still unanswered is scored as missed. */
export function submitSession(session, now = Date.now()) {
  return { ...session, finishedAt: now };
}

/* ── Grading ───────────────────────────────────────────────────────────── */

export function gradeSingle(question, selectedIndex) {
  const correctIndex = question.options.findIndex((option) => option.correct);
  const correct = selectedIndex === correctIndex;
  return {
    format: 'single',
    selectedIndex,
    correctIndex,
    earned: correct ? 1 : 0,
    possible: 1,
  };
}

/**
 * @param {Array<boolean|null>} answers one entry per statement; null = unanswered
 */
export function gradeGroup(question, answers) {
  const statements = question.statements.map((statement, i) => {
    const given = answers[i] ?? null;
    return {
      given,
      expected: statement.answerIsPositive,
      correct: given !== null && given === statement.answerIsPositive,
    };
  });

  return {
    format: 'group',
    statements,
    earned: statements.filter((statement) => statement.correct).length,
    possible: statements.length,
  };
}

/** Open questions are graded by the learner against the model answer. */
export function gradeOpen(question, { text = '', selfRated = false } = {}) {
  return {
    format: 'open',
    text,
    selfRated,
    earned: selfRated ? 1 : 0,
    possible: 1,
  };
}

/* ── Scoring ───────────────────────────────────────────────────────────── */

/**
 * Aggregates a finished (or partial) run.
 * @returns {{earned: number, possible: number, bySection: Array, missed: Array}}
 */
export function scoreSession(session) {
  const bySection = new Map();
  const missed = [];
  let earned = 0;
  let possible = 0;

  session.questions.forEach((question, i) => {
    const response = session.responses[i];
    const points = questionPoints(question);
    const got = response?.earned ?? 0;

    earned += got;
    possible += points;

    const key = sectionOf(question);
    const bucket = bySection.get(key) ?? { section: key, earned: 0, possible: 0 };
    bySection.set(key, {
      ...bucket,
      earned: bucket.earned + got,
      possible: bucket.possible + points,
    });

    if (got < points) missed.push({ question, response, lost: points - got });
  });

  return { earned, possible, bySection: [...bySection.values()], missed };
}

/** The questions a learner did not fully get, for a focused retry. */
export function missedQuestions(session) {
  return scoreSession(session).missed.map((entry) => entry.question);
}
