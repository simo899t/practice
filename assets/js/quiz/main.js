/** Quiz page controller: load an exam file, run it, show the result. */

import { byId, el, icon, ICONS } from '../core/dom.js';
import { mountThemeToggle } from '../core/theme.js';
import { courseParts, percent } from '../core/format.js';
import { recordAttempt, scoreFor } from '../core/storage.js';
import { assetResolver } from '../content/richtext.js';
import { normalizeExam, summarize } from './model.js';
import {
  advance,
  buildRun,
  createSession,
  currentQuestion,
  isLastQuestion,
  missedQuestions,
  respond,
  scoreSession,
} from './session.js';
import { renderSingle } from './views/single.js';
import { renderGroup } from './views/group.js';
import { renderOpen } from './views/open.js';
import { renderSetup } from './views/setup.js';
import { renderResults } from './views/results.js';

const VIEWS = { single: renderSingle, group: renderGroup, open: renderOpen };

const params = new URLSearchParams(location.search);
const examFile = params.get('file');
const examTitle = params.get('title') || 'Practice exam';
const courseTitle = params.get('course') || '';

const app = byId('app');
const counter = byId('counter');
const progressBar = byId('progress');
const barTitle = byId('bar-title');
const barSub = byId('bar-sub');

let questions = [];
let resolve = (path) => path;
let session = null;
let activeView = null;

mountThemeToggle(byId('bar-actions'));

document.title = `${examTitle} · Exam Drill`;
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
  show(
    renderSetup({
      title: examTitle,
      course: courseTitle,
      summary: summarize(questions),
      best: scoreFor(examFile),
      skipped,
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
  activeView.focus?.();
}

function finish() {
  activeView = null;
  const score = scoreSession(session);
  setProgress(session.questions.length, session.questions.length);

  const best = examFile ? recordAttempt(examFile, percent(score.earned, score.possible)) : null;

  show(
    renderResults({
      session,
      score,
      best,
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
  if ((event.metaKey || event.ctrlKey) && event.key !== 'Enter') return;

  activeView.onKey?.(event);
});

/* ── Bootstrap ─────────────────────────────────────────────────────────── */

async function init() {
  if (!examFile) {
    showMessage('No exam selected', 'Pick a test from the course list to get started.');
    app.append(el('div', { class: 'state' }, [
      el('a', { class: 'btn', href: 'index.html' }, [
        icon(ICONS.arrowLeft, { size: 15 }),
        'Browse courses',
      ]),
    ]));
    return;
  }

  showMessage('Loading the test', examTitle, { spinner: true });
  resolve = assetResolver(examFile);

  try {
    const response = await fetch(examFile);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const { questions: parsed, skipped } = normalizeExam(await response.json());
    questions = parsed;
    showSetup(skipped);
  } catch (error) {
    showMessage('Could not load this test', String(error.message ?? error));
  }
}

init();
