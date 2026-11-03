/** A course row on the home page: codes with subject tags, name, test count and progress. */

import { el, icon, ICONS } from '../core/dom.js';
import { plural } from '../core/format.js';
import { courseHref, courseLabel, courseProgress, courseStats, subjectsOf } from '../core/catalog.js';

/** Coloured subject labels: AI501, DS843 -> [AI] [DS]. */
export function subjectTags(course) {
  return el('span', { class: 'tags' },
    subjectsOf(course).map((subject) =>
      el('span', { class: `tag subject-${subject}`, text: subject, title: `${subject} course code` })
    )
  );
}

/** How many tests; the archive is only mentioned when there are none. */
function summaryLine(stats) {
  if (stats.tests) return plural(stats.tests, 'test');
  return stats.archived ? plural(stats.archived, 'archived file') : 'No tests yet';
}

export function courseTile(course, scores) {
  const { codes, name } = courseLabel(course);
  const stats = courseStats(course);
  const progress = courseProgress(course, scores);
  const subject = subjectsOf(course)[0] ?? 'Other';
  const openable = stats.tests + stats.archived > 0;

  const tile = el(openable ? 'a' : 'div', {
    class: `tile subject-${subject}` + (openable ? '' : ' is-empty'),
    href: openable ? courseHref(course) : null,
  }, [
    el('span', { class: 'tile-top' }, [el('span', { class: 'tile-codes', text: codes }), subjectTags(course)]),
    el('span', { class: 'tile-name', text: name }),
  ]);

  const foot = el('span', { class: 'tile-foot' }, [el('span', { text: summaryLine(stats) })]);

  if (progress) {
    const meter = el('span', { class: 'meter' }, [el('span')]);
    meter.firstChild.style.width = `${progress.average}%`;
    tile.append(
      el('span', { class: 'tile-progress', title: `Average of your best scores on ${plural(progress.attempted, 'test')}` }, [
        meter,
        el('span', { text: `${progress.average}% · ${progress.attempted}/${progress.total} tried` }),
      ])
    );
  }

  if (openable) foot.append(icon(ICONS.arrowRight, { size: 17 }));
  tile.append(foot);
  return tile;
}
