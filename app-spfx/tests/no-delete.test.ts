/* Guard: this system never deletes a record, a file, a folder or a project. Removing marks it removed.
   If this test fails, a delete was added. Remove it, or mark the item as removed instead. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test('no code path deletes a SharePoint item, a file or a folder', () => {
  const offenders: string[] = [];
  for (const file of [...sources('src'), 'preview/mockRegister.ts']) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/\.delete\(|deleteObject|recycle\(|\.remove\(\)\s*;?\s*$/.test(line) && !/a\.remove\(\)/.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});
