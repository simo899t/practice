/** Quiz page controller: load a test file, run it, show the result. */

import { byId, el, icon, ICONS } from '../core/dom.js';
import { mountThemeToggle } from '../core/theme.js';
import { courseParts, percent } from '../core/format.js';
import { recordAttempt, scoreFor } from '../core/storage.js';
import { loadDraft } from '../core/drafts.js';
import { assetResolver } from '../content/richtext.js';
import { parseTest } from './markdown.js';
import { summarize } from './model.js';
import {
  advance,
  answeredCount,
  buildRun,
  createSession,
  currentQuestion,
  isLastQuestion,
  missedQuestions,
  respond,
  scoreSession,
  submitSession,
} from './session.js';
import { renderSingle } from './views/single.js';
import { renderGroup } from './views/group.js';
import { renderOpen } from './views/open.js';
import { renderSetup } from './views/setup.js';
import { renderResults } from './views/results.js';

const VIEWS = { single: renderSingle, group: renderGroup, open: renderOpen };

const params = new URLSearchParams(location.search);
const examFile = params.get('file');
// A draft is a test being written on the Add a test page, kept in this browser.
const isDraft = params.has('draft');
const examTitle = params.get('title') || 'Practice exam';
const courseTitle = params.get('course') || '';
const courseId = params.get('courseId');

// Where "back" goes: the page the test was opened from, else the course list.
const back =
  params.get('back') === 'submit'
    ? { href: 'submit.html', label: 'Back to Add a test' }
    : courseId
      ? { href: `course.html?${new URLSearchParams({ id: courseId })}`, label: 'Back to the course' }
      : { href: 'index.html', label: 'All courses' };
byId('back-link').href = back.href;
byId('back-link').title = back.label;
byId('back-link').setAttribute('aria-label', back.label);

const app = byId('app');
const counter = byId('counter');
const progressBar = byId('progress');
const barTitle = byId('bar-title');
const barSub = byId('bar-sub');
const submitButton = byId('submit-test');

let questions = [];
let resolve = (path) => path;
let session = null;
let activeView = null;

mountThemeToggle(byId('bar-actions'));

document.title = `${examTitle} · practice`;
barTitle.textContent = examTitle;
{
  const { codes, name } = courseParts(courseTitle);
  barSub.textContent = [codes, name].filter(Boolean).join(' — ');
}

/* ── Screens ───────────────────────────────────────────────────────────── */

function show(node) {
  app.replaceChildren(node);
  window.scrollTo(0, 0);
}

function setProgress(done, total) {
  progressBar.style.width = total ? `${(done / total) * 100}%` : '0%';
  counter.textContent = total ? `${Math.min(done + 1, total)} / ${total}` : '';
}

function showMessage(title, detail, { spinner = false } = {}) {
  show(
    el('div', { class: 'state' }, [
      spinner ? el('div', { class: 'spinner' }) : null,
      el('h2', { text: title }),
      el('p', { text: detail }),
    ])
  );
}

function showSetup(skipped) {
  setProgress(0, 0);
  submitButton.classList.add('hidden');
  show(
    renderSetup({
      title: examTitle,
      course: courseTitle,
      summary: summarize(questions),
      best: scoreFor(examFile),
      skipped,
      back,
      onStart: (options) => start(questions, options),
    })
  );
}

/* ── Running ───────────────────────────────────────────────────────────── */

function start(pool, { limit = null, shuffle = true } = {}) {
  const run = buildRun(pool, {
    limit,
    shuffleQuestions: shuffle,
    shuffleOptions: shuffle,
  });
  session = createSession({ questions: run });
  renderCurrent();
}

function renderCurrent() {
  const question = currentQuestion(session);
  if (!question) return finish();

  const render = VIEWS[question.format];
  activeView = render({
    question,
    index: session.index,
    total: session.questions.length,
    isLast: isLastQuestion(session),
    resolve,
    onAnswer: (grade) => {
      session = respond(session, grade);
    },
    onNext: () => {
      session = advance(session);
      if (session.finishedAt) finish();
      else renderCurrent();
    },
  });

  show(activeView.node);
  setProgress(session.index, session.questions.length);
  submitButton.classList.remove('hidden');
  activeView.focus?.();
}

/**
 * Ends the run from the top bar. Statements already marked on the current
 * question are kept; everything unanswered counts as missed.
 */
function submitTest() {
  if (!session || session.finishedAt) return;

  const pending = activeView?.pendingGrade?.();
  const settled = pending ? respond(session, pending) : session;
  const total = settled.questions.length;
  const left = total - answeredCount(settled);
  if (left && !confirm(`Submit the test now? Unanswered questions (${left} of ${total}) count as missed.`)) return;

  session = submitSession(settled);
  finish();
}

submitButton.addEventListener('click', submitTest);

function finish() {
  activeView = null;
  submitButton.classList.add('hidden');
  const score = scoreSession(session);
  setProgress(session.questions.length, session.questions.length);

  const best = examFile ? recordAttempt(examFile, percent(score.earned, score.possible)) : null;

  show(
    renderResults({
      session,
      score,
      best,
      back,
      onRestart: () => showSetup(0),
      onRetryMissed: () => start(missedQuestions(session), { limit: null, shuffle: true }),
    })
  );
}

/* ── Keyboard ──────────────────────────────────────────────────────────── */

document.addEventListener('keydown', (event) => {
  if (!activeView || event.altKey) return;
  // Text fields keep their own keys; the open view handles its textarea itself.
  if (event.target instanceof HTMLInputElement) return;
  // Enter and Space on a top-bar control (Submit test, theme) belong to that control.
  if ((event.key === 'Enter' || event.key === ' ') && event.target.closest?.('.appbar')) return;
  if ((event.metaKey || event.ctrlKey) && event.key !== 'Enter') return;

  activeView.onKey?.(event);
});

/* ── Bootstrap ─────────────────────────────────────────────────────────── */

/**
 * The test's Markdown: from its file, or for a draft from this browser, whose
 * figures are served from memory instead of from the test's folder.
 */
async function loadSource() {
  if (isDraft) {
    const draft = await loadDraft();
    if (!draft?.text?.trim()) throw new Error('There is no test being written in this browser.');

    const urls = new Map(draft.files.map(({ path, blob }) => [path, URL.createObjectURL(blob)]));
    resolve = (path) => urls.get(path.trim().replace(/^\.\//, '')) ?? path;
    return draft.text;
  }

  const response = await fetch(examFile, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  resolve = assetResolver(examFile);
  return response.text();
}

async function init() {
  if (!examFile && !isDraft) {
    showMessage('No exam selected', 'Pick a test from the course list to get started.');
    app.append(el('div', { class: 'state' }, [
      el('a', { class: 'btn', href: back.href }, [
        icon(ICONS.arrowLeft, { size: 15 }),
        back.label,
      ]),
    ]));
    return;
  }

  showMessage('Loading the test', examTitle, { spinner: true });

  try {
    const { questions: parsed, skipped, issues } = parseTest(await loadSource());
    if (!parsed.length) throw new Error(issues[0]?.message ?? 'There are no questions in this test.');
    questions = parsed;
    showSetup(skipped);
  } catch (error) {
    showMessage('Could not load this test', String(error.message ?? error));
  }
}

init();
