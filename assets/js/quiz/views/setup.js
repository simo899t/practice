/** Pre-run screen: what this paper holds, and how much of it to attempt. */

import { el, icon, ICONS } from '../../core/dom.js';
import { plural } from '../../core/format.js';
import { FORMATS } from '../model.js';

const LENGTH_CHOICES = [10, 25, 50];

export function renderSetup({ title, course, summary, best, skipped, onStart }) {
  const options = { limit: null, shuffle: true };

  const card = el('section', { class: 'card setup fade-up' }, [
    el('div', { class: 'eyebrow', text: course || 'Exam practice' }),
    el('h1', { text: title }),
    el('p', {
      text: 'Instant feedback after every question. Your best score is kept in this browser.',
    }),
  ]);

  card.append(
    el('div', { class: 'format-pills' },
      summary.formats.map((format) =>
        el('span', { class: 'pill', text: FORMATS[format].label })
      )
    )
  );

  card.append(
    el('div', { class: 'facts' }, [
      fact(summary.count, summary.count === 1 ? 'question' : 'questions'),
      fact(summary.points, 'points'),
      best
        ? el('div', {}, [
            el('b', { text: `${best.best}%` }),
            el('span', { text: `best of ${plural(best.attempts, 'try', 'tries')}` }),
          ])
        : null,
    ])
  );

  const lengths = [{ label: 'All', value: null }].concat(
    LENGTH_CHOICES.filter((value) => value < summary.count).map((value) => ({
      label: String(value),
      value,
    }))
  );

  if (lengths.length > 1) {
    const group = el('div', { class: 'segmented' });
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

    card.append(
      row('Length', 'How many questions to draw from this paper.', group)
    );
  }

  const shuffle = el('input', { type: 'checkbox', checked: true });
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
      }, ['Start practising', icon(ICONS.arrowRight, { size: 16 })]),
      el('a', { class: 'btn btn-ghost btn-lg', href: 'index.html', text: 'All courses' }),
    ])
  );

  if (skipped) {
    card.append(
      el('p', {
        class: 'muted',
        style: 'margin-top:1rem;font-size:var(--step--1)',
        text: `${plural(skipped, 'entry', 'entries')} in this file could not be read and ${
          skipped === 1 ? 'was' : 'were'
        } skipped.`,
      })
    );
  }

  return card;
}

function fact(value, label) {
  return el('div', {}, [el('b', { text: String(value) }), el('span', { text: label })]);
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
