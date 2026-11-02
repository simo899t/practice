/** Home page: every course as a tile, grouped by subject, with search and a subject filter. */

import { byId, el } from '../core/dom.js';
import { mountThemeToggle } from '../core/theme.js';
import { plural } from '../core/format.js';
import { allScores } from '../core/storage.js';
import {
  courseStats,
  groupBySubject,
  loadCatalog,
  subjectName,
  subjectsOf,
} from '../core/catalog.js';
import { courseTile } from './course-tile.js';

const grid = byId('course-grid');
const search = byId('search');
const filters = byId('filters');
const statsBar = byId('stats');

let courses = [];
let activeSubject = 'all';
let query = '';

mountThemeToggle(byId('bar-actions'));

/* ── Filtering ─────────────────────────────────────────────────────────── */

function matchesQuery(course) {
  if (!query) return true;
  const haystack = [
    course.title,
    course.id,
    ...(course.tests ?? []).map((test) => test.title),
    ...(course.archive ?? []).map((item) => `${item.title} ${item.kind ?? ''} ${item.year ?? ''}`),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function render() {
  const scores = allScores();
  const groups = groupBySubject(courses.filter(matchesQuery), activeSubject);
  grid.replaceChildren();

  if (!groups.length) {
    grid.append(
      el('div', { class: 'state' }, [
        el('h2', { text: 'Nothing matches' }),
        el('p', { text: 'Try a different course code, name or test.' }),
      ])
    );
    return;
  }

  groups.forEach(({ subject, courses: list }, g) => {
    const section = el('section', { class: `subject-section subject-${subject}` }, [
      el('header', { class: 'subject-head' }, [
        el('span', { class: 'subject-mark', text: subject }),
        el('h2', { class: 'subject-name', text: subjectName(subject) }),
        el('span', { class: 'subject-count', text: plural(list.length, 'course') }),
      ]),
    ]);

    const tiles = el('div', { class: 'tile-grid' });
    list.forEach((course, i) => {
      const tile = courseTile(course, scores);
      tile.classList.add('fade-up');
      tile.style.animationDelay = `${Math.min(g * 3 + i, 10) * 30}ms`;
      tiles.append(tile);
    });

    section.append(tiles);
    grid.append(section);
  });
}

/* ── Chrome ────────────────────────────────────────────────────────────── */

function renderStats() {
  const totals = courses.map(courseStats).reduce(
    (sum, stats) => ({ tests: sum.tests + stats.tests, questions: sum.questions + stats.questions }),
    { tests: 0, questions: 0 }
  );

  const stat = (value, label) =>
    el('div', { class: 'stat' }, [el('b', { text: String(value) }), el('span', { text: label })]);

  statsBar.replaceChildren(
    stat(courses.length, 'courses'),
    stat(totals.tests, 'tests'),
    stat(totals.questions, 'questions')
  );
}

function renderFilters() {
  const subjects = groupBySubject(courses).map((group) => group.subject);
  // Subjects that only appear as a second code (DS) still get a filter.
  for (const course of courses) {
    for (const subject of subjectsOf(course)) if (!subjects.includes(subject)) subjects.push(subject);
  }

  const options = [{ id: 'all', label: 'All' }].concat(
    subjects.map((subject) => ({ id: subject, label: subject }))
  );

  const buttons = options.map((option) =>
    el('button', {
      type: 'button',
      class: option.id === 'all' ? '' : `subject-${option.id}`,
      text: option.label,
      title: option.id === 'all' ? 'All courses' : `${subjectName(option.id)} (${option.id} codes)`,
      'aria-pressed': String(option.id === activeSubject),
      on: {
        click: () => {
          activeSubject = option.id;
          buttons.forEach((button, i) =>
            button.setAttribute('aria-pressed', String(options[i].id === activeSubject))
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
    courses = await loadCatalog();
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
