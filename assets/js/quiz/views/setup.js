/** Pre-run cover sheet: what this paper holds, and how much of it to attempt. */

import { el, icon, ICONS } from '../../core/dom.js';
import { courseParts, plural } from '../../core/format.js';
import { FORMATS } from '../model.js';

const LENGTH_CHOICES = [10, 25, 50];

export function renderSetup({ title, course, summary, best, skipped, back, onStart }) {
  const options = { limit: null, shuffle: true };

  const { codes, name } = courseParts(course);

  const card = el('section', { class: 'setup fade-in' }, [
    el('p', { class: 'eyebrow', text: codes || 'Exam practice' }),
    el('h1', { text: title }),
    name ? el('p', { class: 'setup-course', text: name }) : null,
    el('p', {
      class: 'setup-lede',
      text: 'Instant feedback after every question. Your best score is kept in this browser.',
    }),
  ]);

  const formats = summary.formats.map((format) => FORMATS[format].label).join(', ');

  card.append(
    el('dl', { class: 'facts' }, [
      fact(summary.count === 1 ? 'Question' : 'Questions', summary.count),
      fact('Points', summary.points),
      fact(summary.formats.length === 1 ? 'Format' : 'Formats', formats, { text: true }),
      best ? fact(`Best of ${plural(best.attempts, 'try', 'tries')}`, `${best.best}%`) : null,
    ])
  );

  const lengths = [{ label: 'All', value: null }].concat(
    LENGTH_CHOICES.filter((value) => value < summary.count).map((value) => ({
      label: String(value),
      value,
    }))
  );

  if (lengths.length > 1) {
    const group = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Length' });
    const buttons = lengths.map(({ label, value }) =>
      el('button', {
        type: 'button',
        text: label,
        'aria-pressed': String(value === options.limit),
        on: {
          click: () => {
            options.limit = value;
            buttons.forEach((button, i) =>
              button.setAttribute('aria-pressed', String(lengths[i].value === value))
            );
          },
        },
      })
    );
    group.append(...buttons);

    card.append(row('Length', 'How many questions to draw from this test.', group));
  }

  const shuffle = el('input', { type: 'checkbox', checked: true, 'aria-label': 'Shuffle' });
  shuffle.addEventListener('change', () => {
    options.shuffle = shuffle.checked;
  });

  card.append(
    row(
      'Shuffle',
      'Mix up the order of questions and answers.',
      el('label', { class: 'switch' }, [shuffle, el('span', { class: 'switch-track' })])
    )
  );

  card.append(
    el('div', { class: 'setup-actions' }, [
      el('button', {
        class: 'btn btn-lg',
        type: 'button',
        on: { click: () => onStart({ ...options }) },
      }, ['Start practising', icon(ICONS.arrowRight, { size: 18 })]),
      el('a', { class: 'btn btn-ghost btn-lg', href: back?.href ?? 'index.html', text: back?.label ?? 'All courses' }),
    ])
  );

  if (skipped) {
    card.append(
      el('p', {
        class: 'setup-note',
        text: `${plural(skipped, 'question')} in this test could not be read and ${
          skipped === 1 ? 'was' : 'were'
        } left out.`,
      })
    );
  }

  return card;
}

function fact(label, value, { text = false } = {}) {
  return el('div', {}, [
    el('dt', { text: label }),
    el('dd', { class: text ? 'is-text' : '', text: String(value) }),
  ]);
}

function row(label, description, control) {
  return el('div', { class: 'option-row' }, [
    el('div', { class: 'label' }, [
      el('b', { text: label }),
      el('span', { text: description }),
    ]),
    control,
  ]);
}
