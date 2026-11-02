/** The pages must load the current CSS and JS, never a stale cached copy. */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGES, assetVersions, stampHtml } from '../tools/stamp-assets.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const versions = assetVersions(ROOT);

for (const page of PAGES) {
  test(`${page} carries current asset stamps (run \`npm run stamp\` if this fails)`, () => {
    const html = readFileSync(join(ROOT, page), 'utf8');
    assert.equal(html, stampHtml(html, versions));
  });

  test(`${page} only references assets that exist`, () => {
    const html = readFileSync(join(ROOT, page), 'utf8');
    for (const [, path] of html.matchAll(/(?:href|src)="(assets\/(?:css|js)\/[^"?]+)/g)) {
      assert.ok(versions.has(path), `${page} points at a missing file: ${path}`);
    }
  });
}

test('stampHtml versions links, scripts and the import map', () => {
  const sample = new Map([
    ['assets/css/a.css', '111'],
    ['assets/js/x/main.js', '222'],
    ['assets/js/core/dom.js', '333'],
  ]);
  const html = [
    '<link rel="stylesheet" href="assets/css/a.css?v=old">',
    '<script type="importmap">{}</script>',
    '<script type="module" src="assets/js/x/main.js"></script>',
    '<link rel="stylesheet" href="https://cdn.example/katex.css">',
  ].join('\n');

  const out = stampHtml(html, sample);
  assert.match(out, /href="assets\/css\/a\.css\?v=111"/);
  assert.match(out, /src="assets\/js\/x\/main\.js\?v=222"/);
  assert.match(out, /"\.\/assets\/js\/core\/dom\.js": "\.\/assets\/js\/core\/dom\.js\?v=333"/);
  assert.match(out, /https:\/\/cdn\.example\/katex\.css"/);
  assert.equal(stampHtml(out, sample), out, 'stamping twice changes nothing');
});
