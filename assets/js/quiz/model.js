/**
 * Exam data model.
 *
 * An exam file is a JSON array of items in one of three formats:
 *
 *   single — one question, several options, exactly one correct
 *     { type, section, context, text, options: [{ text, correct, note }] }
 *
 *   group  — one shared context with binary sub-statements (True/False, Yes/No)
 *     { type, section, context, positiveLabel, negativeLabel,
 *       statements: [{ text, answerIsPositive, positiveNote, negativeNote }] }
 *
 *   open   — a written answer, compared against a model answer and self-graded
 *     { type, section, context, text, answer }
 *
 * Every function here is pure: nothing touches the DOM or mutates its input.
 */

export const FORMATS = {
  single: { id: 'single', label: 'Multiple choice', short: 'MCQ' },
  group: { id: 'group', label: 'True / false', short: 'T/F' },
  open: { id: 'open', label: 'Written answer', short: 'Open' },
};

const isObject = (value) => typeof value === 'object' && value !== null;
const text = (value) => (typeof value === 'string' ? value : '');

function detectFormat(item) {
  if (item.type === 'group' || Array.isArray(item.statements)) return 'group';
  if (item.type === 'open' || typeof item.answer === 'string') return 'open';
  if (item.type === 'single' || Array.isArray(item.options)) return 'single';
  return null;
}

function normalizeSingle(item, id) {
  const options = (item.options ?? [])
    .filter(isObject)
    .map((option) => ({
      text: text(option.text),
      correct: option.correct === true,
      note: text(option.note),
    }));

  if (options.length < 2 || !options.some((option) => option.correct)) return null;

  return {
    id,
    format: 'single',
    section: text(item.section),
    context: text(item.context),
    text: text(item.text),
    options,
  };
}

function normalizeGroup(item, id) {
  const statements = (item.statements ?? [])
    .filter(isObject)
    .map((statement) => ({
      text: text(statement.text),
      answerIsPositive: statement.answerIsPositive === true,
      positiveNote: text(statement.positiveNote),
      negativeNote: text(statement.negativeNote),
    }));

  if (!statements.length) return null;

  return {
    id,
    format: 'group',
    section: text(item.section),
    context: text(item.context),
    text: text(item.text),
    positiveLabel: text(item.positiveLabel) || 'True',
    negativeLabel: text(item.negativeLabel) || 'False',
    statements,
  };
}

function normalizeOpen(item, id) {
  const prompt = text(item.text);
  const context = text(item.context);
  if (!prompt.trim() && !context.trim()) return null;

  // Some papers are transcribed before their model answers are written up;
  // the question is still worth practising, so keep it and say so.
  const answer = text(item.answer);

  return {
    id,
    format: 'open',
    section: text(item.section),
    context,
    text: prompt,
    answer,
    hasAnswer: Boolean(answer.trim()),
  };
}

const NORMALIZERS = {
  single: normalizeSingle,
  group: normalizeGroup,
  open: normalizeOpen,
};

/**
 * Validates and normalizes a parsed exam file, skipping unusable entries
 * (some authored files end with an empty `{}` placeholder).
 * @returns {{questions: Array, skipped: number}}
 */
export function normalizeExam(raw) {
  if (!Array.isArray(raw)) throw new Error('Exam file must be a JSON array.');

  const questions = [];
  let skipped = 0;

  raw.forEach((item, index) => {
    const format = isObject(item) ? detectFormat(item) : null;
    const question = format ? NORMALIZERS[format](item, `q${index}`) : null;
    if (question) questions.push(question);
    else skipped += 1;
  });

  if (!questions.length) throw new Error('No usable questions in this exam file.');
  return { questions, skipped };
}

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
