/**
 * Question model. markdown.js reads a test file into questions of three formats:
 *
 *   single — one question, several options, exactly one correct
 *     { id, format, section, context, text, options: [{ text, correct, note }] }
 *
 *   group  — binary statements (True/False, Yes/No) under one question
 *     { id, format, section, context, text, positiveLabel, negativeLabel,
 *       statements: [{ text, answerIsPositive, note }] }
 *
 *   open   — a written answer, compared against a model answer and self-graded
 *     { id, format, section, context, text, answer, hasAnswer }
 *
 * `context` is the optional setup shown above the question `text`; notes are
 * shown once the question is answered. Every function here is pure.
 */

export const FORMATS = {
  single: { id: 'single', label: 'Multiple choice', short: 'MCQ' },
  group: { id: 'group', label: 'True / false', short: 'T/F' },
  open: { id: 'open', label: 'Written answer', short: 'Open' },
};

/** Points a question is worth: one per statement for groups, else one. */
export function questionPoints(question) {
  return question.format === 'group' ? question.statements.length : 1;
}

export function totalPoints(questions) {
  return questions.reduce((sum, question) => sum + questionPoints(question), 0);
}

/** Distinct formats present, in display order. */
export function examFormats(questions) {
  return Object.keys(FORMATS).filter((format) =>
    questions.some((question) => question.format === format)
  );
}

/** Headline numbers for the setup screen. */
export function summarize(questions) {
  return {
    count: questions.length,
    points: totalPoints(questions),
    formats: examFormats(questions),
  };
}

/** Section label for grouping results; falls back to the format name. */
export function sectionOf(question) {
  return question.section.trim() || FORMATS[question.format].label;
}
