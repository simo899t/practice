#!/usr/bin/env node
/**
 * Stamps every stylesheet and script the pages load with a hash of its
 * contents, so a deploy can never mix new HTML with stale cached CSS or JS
 * (GitHub Pages lets browsers keep files for ten minutes).
 *
 *   node tools/stamp-assets.mjs        # rewrite the pages in place
 *
 * - <link href="assets/css/x.css"> and <script src="assets/js/…"> get ?v=<hash>.
 * - The page's <script type="importmap"> maps every module under assets/js to
 *   its stamped URL, which covers the modules the entry scripts import.
 *
 * `npm run sync` runs this too, and `npm test` fails when a stamp is stale.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const PAGES = ['index.html', 'course.html', 'quiz.html'];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Map of "assets/…/file.ext" -> short content hash, for every CSS and JS file. */
export function assetVersions(root = ROOT) {
  const files = [...walk(join(root, 'assets', 'css')), ...walk(join(root, 'assets', 'js'))]
    .filter((path) => /\.(css|js)$/.test(path))
    .sort();

  return new Map(
    files.map((path) => [
      relative(root, path).split(sep).join('/'),
      createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 10),
    ])
  );
}

function importMap(versions) {
  const imports = {};
  for (const [path, hash] of versions) {
    if (path.endsWith('.js')) imports[`./${path}`] = `./${path}?v=${hash}`;
  }
  const json = JSON.stringify({ imports }, null, 2).replace(/\n/g, '\n  ');
  return `<script type="importmap">\n  ${json}\n  </script>`;
}

/** Returns `html` with every local CSS/JS reference and the import map stamped. */
export function stampHtml(html, versions) {
  return html
    .replace(
      /\b(href|src)="(assets\/(?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"/g,
      (match, attr, path) => (versions.has(path) ? `${attr}="${path}?v=${versions.get(path)}"` : match)
    )
    .replace(/<script type="importmap">[\s\S]*?<\/script>/, importMap(versions));
}

/** Stamps the pages; returns the ones that changed. */
export function stampPages({ root = ROOT, write = true } = {}) {
  const versions = assetVersions(root);
  const changed = [];

  for (const page of PAGES) {
    const file = join(root, page);
    const html = readFileSync(file, 'utf8');
    const stamped = stampHtml(html, versions);
    if (stamped !== html) {
      changed.push(page);
      if (write) writeFileSync(file, stamped);
    }
  }
  return changed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const changed = stampPages();
  console.log(changed.length ? `✓  stamped ${changed.join(', ')}` : '✓  asset stamps are up to date');
}
