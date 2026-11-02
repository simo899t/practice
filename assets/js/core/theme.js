/** Theme switching: system by default, overridable, remembered per browser. */

import { el, icon, ICONS } from './dom.js';
import { readString, writeString } from './storage.js';

const KEY = 'theme';
const ORDER = ['system', 'light', 'dark'];

export function currentTheme() {
  const saved = readString(KEY, 'system');
  return ORDER.includes(saved) ? saved : 'system';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

function resolved(theme) {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Renders a cycling theme button into `mount`. */
export function mountThemeToggle(mount) {
  let theme = currentTheme();
  applyTheme(theme);

  const button = el('button', {
    class: 'icon-btn',
    type: 'button',
    title: 'Switch theme',
    'aria-label': 'Switch theme',
  });

  const paint = () => {
    button.replaceChildren(icon(resolved(theme) === 'light' ? ICONS.sun : ICONS.moon));
    button.dataset.theme = theme;
  };

  button.addEventListener('click', () => {
    theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    writeString(KEY, theme);
    applyTheme(theme);
    paint();
  });

  window
    .matchMedia('(prefers-color-scheme: light)')
    .addEventListener('change', () => theme === 'system' && paint());

  paint();
  mount.append(button);
  return button;
}

// Apply as early as possible so there is no flash of the wrong palette.
applyTheme(currentTheme());
