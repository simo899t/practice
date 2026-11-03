/** Course page: the course's tests as cards, then its archive of older material. */

import { byId, el, icon, ICONS } from '../core/dom.js';
import { mountThemeToggle } from '../core/theme.js';
import { plural } from '../core/format.js';
import { allScores } from '../core/storage.js';
import {
  courseLabel,
  courseProgress,
  courseStats,
  findCourse,
  loadCatalog,
  subjectName,
  subjectsOf,
  testHref,
} from '../core/catalog.js';
import { FORMATS } from '../quiz/model.js';
import { subjectTags } from '../home/course-tile.js';

const app = byId('app');
const courseId = new URLSearchParams(location.search).get('id');

mountThemeToggle(byId('bar-actions'));

/* ── Tests ─────────────────────────────────────────────────────────────── */

function formatsLine(test) {
  const bits = [];
  if (test.questions) bits.push(el('span', { text: plural(test.questions, 'question') }));
  (test.formats ?? []).forEach((format) => {
    const label = FORMATS[format]?.label;
    if (label) bits.push(el('span', { class: 'dot', 'aria-hidden': 'true' }), el('span', { text: label }));
  });
  return bits;
}

/** "final-answers" reads better as "Answers" when a test ships with its key. */
function sourceLabel(source, count) {
  if (count > 1 && /answer|solution|key/i.test(source.name)) return 'Answers';
  return 'PDF';
}

function sourceLinks(test) {
  const sources = test.sources ?? [];
  return sources.map((source) =>
    el('a', {
      class: 'file-chip',
      href: source.file,
      target: '_blank',
      rel: 'noopener',
      title: `${source.name} (PDF)`,
      'aria-label': `Open the original PDF: ${source.name}`,
    }, [icon(ICONS.file, { size: 14 }), el('span', { text: sourceLabel(source, sources.length) })])
  );
}

function scoreLine(test, scores) {
  const best = scores[test.file];
  if (!best) return el('p', { class: 'test-score is-new', text: 'Not tried yet' });

  const tone = best.best >= 70 ? ' is-good' : best.best < 50 ? ' is-bad' : '';
  const meter = el('span', { class: 'meter' + (best.best >= 70 ? ' is-good' : best.best < 50 ? ' is-bad' : '') }, [el('span')]);
  meter.firstChild.style.width = `${best.best}%`;

  return el('p', { class: 'test-score' + tone }, [
    meter,
    el('span', {}, [el('b', { text: `${best.best}%` }), ` best · ${plural(best.attempts, 'attempt')}`]),
  ]);
}

/**
 * The title link stretches over the whole card (see .test-link::after) and the
 * PDF links sit above it, so the card is one target without nested links.
 */
function testCard(course, test, scores) {
  return el('article', { class: 'test-card' }, [
    el('h3', { class: 'test-title' }, [
      el('a', { class: 'test-link', href: testHref(course, test), text: test.title }),
    ]),
    el('p', { class: 'test-meta' }, formatsLine(test)),
    scoreLine(test, scores),
    el('div', { class: 'test-foot' }, [
      el('span', { class: 'test-files' }, sourceLinks(test)),
      el('span', { class: 'test-start', 'aria-hidden': 'true' }, [
        'Start',
        icon(ICONS.arrowRight, { size: 15 }),
      ]),
    ]),
  ]);
}

/* ── Archive ───────────────────────────────────────────────────────────── */

const extensionOf = (file) => (String(file).match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toUpperCase();

function archiveItem(item) {
  const meta = [item.kind, item.year, extensionOf(item.file)].filter(Boolean).join(' · ');
  return el('li', {}, [
    el('a', { class: 'archive-item', href: item.file, target: '_blank', rel: 'noopener' }, [
      icon(ICONS.file, { size: 15 }),
      el('span', { class: 'archive-title', text: item.title }),
      meta ? el('span', { class: 'archive-meta', text: meta }) : null,
    ]),
  ]);
}

/* ── Page ──────────────────────────────────────────────────────────────── */

function fact(value, label) {
  return el('div', { class: 'stat' }, [el('b', { text: String(value) }), el('span', { text: label })]);
}

function renderCourse(course) {
  const scores = allScores();
  const { codes, name } = courseLabel(course);
  const stats = courseStats(course);
  const progress = courseProgress(course, scores);
  const subject = subjectsOf(course)[0] ?? 'Other';

  document.title = `${name} · practice`;

  const head = el('header', { class: `course-head subject-${subject}` }, [
    el('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, [
      el('a', { href: 'index.html', text: 'All courses' }),
      el('span', { 'aria-hidden': 'true', text: '/' }),
      el('span', { text: subjectName(subject) }),
    ]),
    el('div', { class: 'course-id' }, [el('span', { class: 'course-codes', text: codes }), subjectTags(course)]),
    el('h1', { class: 'course-title', text: name }),
    el('div', { class: 'stats' }, [
      fact(stats.tests, stats.tests === 1 ? 'test' : 'tests'),
      fact(stats.questions, 'questions'),
      progress ? fact(`${progress.average}%`, `your average · ${progress.attempted}/${progress.total} tried`) : null,
      stats.archived ? fact(stats.archived, 'archived files') : null,
    ]),
  ]);

  const page = el('div', { class: 'course-page fade-in' }, [head]);

  const tests = course.tests ?? [];
  const testsSection = el('section', { class: 'course-section' }, [
    el('h2', { class: 'section-title' }, ['Tests', el('span', { class: 'section-count', text: String(tests.length) })]),
  ]);
  testsSection.append(
    tests.length
      ? el('div', { class: 'test-grid' }, tests.map((test) => testCard(course, test, scores)))
      : el('p', { class: 'course-empty', text: 'No tests transcribed yet.' })
  );
  page.append(testsSection);

  const archive = course.archive ?? [];
  if (archive.length) {
    page.append(
      el('section', { class: 'course-section archive' }, [
        el('h2', { class: 'section-title' }, ['Archive', el('span', { class: 'section-count', text: String(archive.length) })]),
        el('p', {
          class: 'archive-note',
          text: 'Older exams, project descriptions and other material. They open as files, not as quizzes.',
        }),
        el('ul', { class: 'archive-list' }, archive.map(archiveItem)),
      ])
    );
  }

  app.replaceChildren(page);
}

function showMessage(title, detail) {
  app.replaceChildren(
    el('div', { class: 'state' }, [
      el('h2', { text: title }),
      el('p', { text: detail }),
      el('a', { class: 'btn', href: 'index.html' }, [icon(ICONS.arrowLeft, { size: 15 }), 'All courses']),
    ])
  );
}

async function init() {
  if (!courseId) {
    showMessage('No course selected', 'Pick a course from the list to see its tests.');
    return;
  }
  try {
    const course = findCourse(await loadCatalog(), courseId);
    if (!course) showMessage('Course not found', `There is no course called “${courseId}”.`);
    else renderCourse(course);
  } catch (error) {
    showMessage('Could not load the course list', String(error.message ?? error));
  }
}

init();
