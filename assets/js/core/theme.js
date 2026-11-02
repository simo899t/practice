/** Theme switching: light by default, dark on request, remembered per browser. */

import { el, icon, ICONS } from './dom.js';
import { readString, writeString } from './storage.js';

const KEY = 'theme';

export function currentTheme() {
  return readString(KEY, 'light') === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}

/** Renders a light/dark toggle into `mount`. */
export function mountThemeToggle(mount) {
  let theme = currentTheme();
  applyTheme(theme);

  const button = el('button', {
    class: 'icon-btn',
    type: 'button',
    title: 'Switch between light and dark',
    'aria-label': 'Switch between light and dark',
  });

  const paint = () => {
    button.replaceChildren(icon(theme === 'dark' ? ICONS.moon : ICONS.sun));
    button.setAttribute('aria-pressed', String(theme === 'dark'));
  };

  button.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    writeString(KEY, theme);
    applyTheme(theme);
    paint();
  });

  paint();
  mount.append(button);
  return button;
}

// Apply as early as possible so there is no flash of the wrong palette.
applyTheme(currentTheme());
