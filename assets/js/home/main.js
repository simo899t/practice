/** Course browser: load the manifest, filter it, render the grid. */

import { byId, el } from '../core/dom.js';
import { mountThemeToggle } from '../core/theme.js';
import { codePrefixes } from '../core/format.js';
import { archiveMatches, courseCard } from './course-card.js';

const MANIFEST = 'courses/manifest.json';

const grid = byId('course-grid');
const search = byId('search');
const filters = byId('filters');
const statsBar = byId('stats');

let courses = [];
let activeTag = 'all';
let query = '';

mountThemeToggle(byId('bar-actions'));

/* ── Filtering ─────────────────────────────────────────────────────────── */

function matches(course) {
  if (activeTag !== 'all' && !codePrefixes(course.title).includes(activeTag)) return false;
  if (!query) return true;

  const haystack = [course.title, course.id, ...(course.tests ?? []).map((t) => t.title)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query) || (course.archive ?? []).some((item) => archiveMatches(item, query));
}

/** Courses with papers first; manifest order is kept inside each group. */
function byReadiness(a, b) {
  return Number((b.tests ?? []).length > 0) - Number((a.tests ?? []).length > 0);
}

function render() {
  const visible = courses.filter(matches).sort(byReadiness);
  grid.replaceChildren();

  if (!visible.length) {
    grid.append(
      el('div', { class: 'state' }, [
        el('h2', { text: 'Nothing matches' }),
        el('p', { text: 'Try a different course code, title or filter.' }),
      ])
    );
    return;
  }

  visible.forEach((course, i) => {
    const card = courseCard(course, { query });
    card.classList.add('fade-up');
    card.style.animationDelay = `${Math.min(i, 8) * 30}ms`;
    grid.append(card);
  });
}

/* ── Chrome ────────────────────────────────────────────────────────────── */

function renderStats() {
  const withExams = courses.filter((course) => (course.tests ?? []).length);
  const papers = withExams.reduce((sum, course) => sum + course.tests.length, 0);
  const questions = withExams.reduce(
    (sum, course) => sum + course.tests.reduce((n, exam) => n + (exam.questions ?? 0), 0),
    0
  );

  const stat = (value, label) =>
    el('div', { class: 'stat' }, [
      el('b', { text: String(value) }),
      el('span', { text: label }),
    ]);

  statsBar.replaceChildren(
    stat(courses.length, 'courses'),
    stat(papers, 'papers'),
    stat(questions, 'questions')
  );
}

function renderFilters() {
  const tags = [...new Set(courses.flatMap((course) => codePrefixes(course.title)))].sort();
  const options = [{ id: 'all', label: 'All' }].concat(
    tags.map((tag) => ({ id: tag, label: tag }))
  );

  const buttons = options.map((option) =>
    el('button', {
      type: 'button',
      title: option.id === 'all' ? 'All courses' : `Courses with a ${option.label} code`,
      text: option.label,
      'aria-pressed': String(option.id === activeTag),
      on: {
        click: () => {
          activeTag = option.id;
          buttons.forEach((button, i) =>
            button.setAttribute('aria-pressed', String(options[i].id === activeTag))
          );
          render();
        },
      },
    })
  );

  filters.replaceChildren(...buttons);
}

search.addEventListener('input', () => {
  query = search.value.trim().toLowerCase();
  render();
});

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === 'Escape' && document.activeElement === search) {
    search.value = '';
    query = '';
    search.blur();
    render();
  }
});

/* ── Bootstrap ─────────────────────────────────────────────────────────── */

async function init() {
  try {
    const response = await fetch(MANIFEST);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('manifest.json must be a JSON array.');

    courses = data;
    renderStats();
    renderFilters();
    render();
  } catch (error) {
    grid.replaceChildren(
      el('div', { class: 'state' }, [
        el('h2', { text: 'Could not load the course list' }),
        el('p', { text: String(error.message ?? error) }),
        el('p', {
          class: 'muted',
          text: 'The site needs to be served over http — open it with a local server, not as a file.',
        }),
      ])
    );
  }
}

init();
