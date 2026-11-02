import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { assetResolver, plainText, splitCode } from '../assets/js/content/richtext.js';

test('resolves asset paths relative to the exam file', () => {
  const resolve = assetResolver('courses/AI503_CALC/exam2026-jan/exam2026.json');
  assert.equal(
    resolve('assets/FIG.png'),
    'courses/AI503_CALC/exam2026-jan/assets/FIG.png'
  );
});

test('leaves absolute and remote paths untouched', () => {
  const resolve = assetResolver('courses/x/y.json');
  assert.equal(resolve('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(resolve('/a.png'), '/a.png');
});

test('splits a trailing code listing out of the prose', () => {
  const { prose, code } = splitCode('Setup: Code:\nfor i in x:\n    print(i)');
  assert.equal(prose, 'Setup: Code:');
  assert.equal(code, 'for i in x:\n    print(i)');
});

test('splits a listing that starts on the same line as the label', () => {
  const { prose, code } = splitCode('What is the running time?\n\nCode: ALG(n)\n  s = 0');
  assert.equal(prose, 'What is the running time?\n\nCode:');
  assert.equal(code, 'ALG(n)\n  s = 0');
});

test('leaves prose without a listing alone', () => {
  const { prose, code } = splitCode('No listing here.');
  assert.equal(prose, 'No listing here.');
  assert.equal(code, null);
});

test('plainText drops image tokens and collapses whitespace', () => {
  assert.equal(plainText('See [image: assets/a.png]\nthe  figure'), 'See the figure');
  assert.equal(plainText(undefined), '');
});
