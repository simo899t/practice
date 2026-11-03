import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { assetResolver, closesFence, fenceStart, plainText, splitBlocks } from '../assets/js/content/richtext.js';

test('resolves asset paths relative to the test file', () => {
  const resolve = assetResolver('courses/AI503_CALC/exam2026-jan/exam2026.md');
  assert.equal(resolve('assets/FIG.png'), 'courses/AI503_CALC/exam2026-jan/assets/FIG.png');
  assert.equal(resolve('./assets/FIG.png'), 'courses/AI503_CALC/exam2026-jan/assets/FIG.png');
});

test('leaves absolute, remote and in-memory paths untouched', () => {
  const resolve = assetResolver('courses/x/y.md');
  assert.equal(resolve('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(resolve('/a.png'), '/a.png');
  assert.equal(resolve('blob:http://localhost/1234'), 'blob:http://localhost/1234');
});

test('splits prose from fenced code listings, in order', () => {
  assert.deepEqual(splitBlocks('Before:\n```python\nfor i in x:\n    print(i)\n```\nAfter.'), [
    { prose: 'Before:' },
    { code: 'for i in x:\n    print(i)' },
    { prose: 'After.' },
  ]);
  assert.deepEqual(splitBlocks('~~~\n```\n~~~'), [{ code: '```' }]);
  assert.deepEqual(splitBlocks('Open:\n```\nruns to the end'), [{ prose: 'Open:' }, { code: 'runs to the end' }]);
  assert.deepEqual(splitBlocks('No listing.'), [{ prose: 'No listing.' }]);
});

test('a fence closes only with the same character, at least as long', () => {
  assert.equal(fenceStart('````js'), '````');
  assert.equal(fenceStart('text ```'), null);
  assert.equal(closesFence('```', '````'), false);
  assert.equal(closesFence('`````', '````'), true);
  assert.equal(closesFence('~~~', '```'), false);
});

test('plainText drops figures, listings and markup', () => {
  assert.equal(plainText('See ![graph](assets/a.png)\nthe  **figure**'), 'See the figure');
  assert.equal(plainText('Run:\n```\nls -la\n```'), 'Run:');
  assert.equal(plainText(undefined), '');
});
