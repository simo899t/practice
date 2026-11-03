import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { crc32, zip } from '../assets/js/submit/zip.js';

const bytes = (text) => new TextEncoder().encode(text);

/** Reads an archive back through its central directory, as an unzip tool would. */
function unzip(archive) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.byteLength - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50, 'end of central directory');

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = [];
  for (let i = 0; i < count; i += 1) {
    assert.equal(view.getUint32(at, true), 0x02014b50, 'central directory entry');
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(archive.subarray(at + 46, at + 46 + nameLength));

    assert.equal(view.getUint32(local, true), 0x04034b50, 'local header');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = archive.subarray(start, start + size);
    assert.equal(crc32(data), crc, `${name} checksum`);
    files.push({ name, text: new TextDecoder().decode(data) });
    at += 46 + nameLength;
  }
  return files;
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(bytes('123456789')), 0xcbf43926);
  assert.equal(crc32(bytes('')), 0);
});

test('zip stores files and folders that read back intact', () => {
  const archive = zip([
    { path: 'exam-may-2023/exam-may-2023.md', bytes: bytes('## Question 1\nWhy?\n') },
    { path: 'exam-may-2023/assets/graph.svg', bytes: bytes('<svg/>') },
    { path: 'æøå.md', bytes: bytes('') },
  ]);

  assert.deepEqual(unzip(archive), [
    { name: 'exam-may-2023/exam-may-2023.md', text: '## Question 1\nWhy?\n' },
    { name: 'exam-may-2023/assets/graph.svg', text: '<svg/>' },
    { name: 'æøå.md', text: '' },
  ]);
});
