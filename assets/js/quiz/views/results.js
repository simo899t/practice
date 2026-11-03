/** Results screen: headline score, per-section breakdown, what went wrong. */

import { el, icon, ICONS } from '../../core/dom.js';
import { duration, percent, plural, truncate } from '../../core/format.js';
import { plainText } from '../../content/richtext.js';
import { renderMath } from '../../content/math.js';
import { sectionOf } from '../model.js';

const RING_RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const VERDICTS = [
  { min: 90, title: 'Exam-ready', line: 'Nearly everything landed. Keep it warm with a shuffle.' },
  { min: 70, title: 'Solid run', line: 'A good pass — the misses below are the cheapest marks to win back.' },
  { min: 50, title: 'Halfway there', line: 'The shape is right. Work the weak sections and run it again.' },
  { min: 0, title: 'Worth another pass', line: 'Read the notes under each miss, then retry just those.' },
];

export function renderResults({ session, score, best, back, onRestart, onRetryMissed }) {
  const pct = percent(score.earned, score.possible);
  const verdict = VERDICTS.find((entry) => pct >= entry.min);
  const elapsed = (session.finishedAt ?? Date.now()) - session.startedAt;

  const view = el('section', { class: 'fade-in' });
  view.append(scoreCard({ pct, score, verdict, elapsed, best }));

  // Papers that label every question separately gain nothing from a breakdown.
  const grouped =
    score.bySection.length > 1 && score.bySection.length < session.questions.length;
  if (grouped) view.append(breakdownPanel(score.bySection));
  if (score.missed.length) view.append(reviewPanel(score.missed));

  view.append(
    el('div', { class: 'results-actions' }, [
      score.missed.length
        ? el('button', {
            class: 'btn',
            type: 'button',
            on: { click: onRetryMissed },
          }, [`Retry the ${plural(score.missed.length, 'miss', 'misses')}`, icon(ICONS.arrowRight, { size: 15 })])
        : null,
      el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'Restart this test',
        on: { click: onRestart },
      }),
      el('a', { class: 'btn btn-ghost', href: back?.href ?? 'index.html', text: back?.label ?? 'All courses' }),
    ])
  );

  return view;
}

function scoreCard({ pct, score, verdict, elapsed, best }) {
  return el('section', { class: 'score-card' }, [
    ring(pct),
    el('div', { class: 'score-copy' }, [
      el('p', { class: 'eyebrow', text: 'Your result' }),
      el('h1', { text: verdict.title }),
      el('p', { text: verdict.line }),
      el('div', { class: 'score-tags' }, [
        el('span', {
          class: 'pill',
          text: `${score.earned} / ${score.possible} points`,
        }),
        el('span', { class: 'pill', text: duration(elapsed) }),
        best
          ? el('span', {
              class: 'pill',
              text:
                pct >= best.best
                  ? `Best yet · ${plural(best.attempts, 'attempt')}`
                  : `Best ${best.best}% · ${plural(best.attempts, 'attempt')}`,
            })
          : null,
      ]),
    ]),
  ]);
}

function ring(pct) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('viewBox', '0 0 124 124');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Score ${pct} percent`);

  const make = (className) => {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('class', className);
    circle.setAttribute('cx', '62');
    circle.setAttribute('cy', '62');
    circle.setAttribute('r', String(RING_RADIUS));
    return circle;
  };

  const value = make('value');
  value.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
  value.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE));
  if (pct >= 70) value.style.stroke = 'var(--good)';
  else if (pct < 50) value.style.stroke = 'var(--bad)';

  const label = document.createElementNS(ns, 'text');
  label.setAttribute('x', '62');
  label.setAttribute('y', '63');
  label.textContent = `${pct}%`;

  svg.append(make('track'), value, label);

  requestAnimationFrame(() => {
    value.setAttribute(
      'stroke-dashoffset',
      String(CIRCUMFERENCE * (1 - Math.min(pct, 100) / 100))
    );
  });

  return svg;
}

function breakdownPanel(bySection) {
  const panel = el('section', { class: 'panel' }, [
    el('h2', { text: 'By section' }),
  ]);

  const list = el('div', { class: 'breakdown' });
  [...bySection]
    .sort((a, b) => percent(a.earned, a.possible) - percent(b.earned, b.possible))
    .forEach((entry) => {
      const pct = percent(entry.earned, entry.possible);
      const meter = el('div', {
        class: 'meter ' + (pct >= 70 ? 'is-good' : pct < 50 ? 'is-bad' : ''),
      }, [el('span')]);

      requestAnimationFrame(() => {
        meter.firstChild.style.width = `${pct}%`;
      });

      list.append(
        el('div', { class: 'breakdown-row' }, [
          el('div', { class: 'top' }, [
            el('span', { class: 'name', text: truncate(entry.section, 70) }),
            el('span', { class: 'num', text: `${entry.earned}/${entry.possible} · ${pct}%` }),
          ]),
          meter,
        ])
      );
    });

  panel.append(list);
  return panel;
}

function reviewPanel(missed) {
  const panel = el('section', { class: 'panel' }, [
    el('h2', { text: `Worth another look (${missed.length})` }),
  ]);

  const list = el('ul', { class: 'review-list' });
  missed.forEach(({ question, response }) => {
    list.append(
      el('li', { class: 'review-item' }, [
        el('div', { class: 'q', text: promptOf(question) }),
        el('div', { class: 'a' }, answerLine(question, response)),
      ])
    );
  });

  panel.append(list);
  renderMath(panel);
  return panel;
}

function promptOf(question) {
  const prompt = plainText(question.text) || plainText(question.context);
  return truncate(prompt || sectionOf(question), 220);
}

function answerLine(question, response) {
  if (question.format === 'single') {
    const correct = question.options.find((option) => option.correct);
    return [
      document.createTextNode('Answer: '),
      el('b', { text: truncate(plainText(correct?.text ?? ''), 140) }),
    ];
  }

  if (question.format === 'group') {
    const missedCount = (response?.statements ?? []).filter((s) => !s.correct).length;
    const total = question.statements.length;
    return [
      document.createTextNode(
        response
          ? `${missedCount} of ${total} statements wrong`
          : `Not attempted · ${plural(total, 'statement')}`
      ),
    ];
  }

  return [document.createTextNode(response ? 'Marked as missed' : 'Not attempted')];
}
