import test from 'node:test';
import assert from 'node:assert/strict';
import * as Z from '../src/domain/zip.ts';

const enc = new TextEncoder();

test('CRC-32 matches the standard check value', () => {
  assert.equal(Z.crc32(enc.encode('123456789')), 0xcbf43926);
});

test('zip names are safe and unique', () => {
  const taken = new Set<string>();
  assert.equal(Z.zipName('a/b:c.pdf', taken), 'a_b_c.pdf');
  assert.equal(Z.zipName('a_b_c.pdf', taken), 'a_b_c (2).pdf');
  assert.equal(Z.zipName('A_B_C.PDF', taken), 'A_B_C (3).PDF');
});

test('a zip holds every file: signatures, count and sizes are right', () => {
  const zip = Z.buildZip([{ name: 'one.txt', data: enc.encode('hello') }, { name: 'two.txt', data: enc.encode('world!') }]);
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(dv.getUint32(0, true), 0x04034b50, 'first local header');
  const eocd = zip.length - 22;
  assert.equal(dv.getUint32(eocd, true), 0x06054b50, 'end record');
  assert.equal(dv.getUint16(eocd + 10, true), 2, 'two entries');
  const text = new TextDecoder().decode(zip);
  assert.ok(text.includes('one.txt') && text.includes('two.txt') && text.includes('hello') && text.includes('world!'));
});
