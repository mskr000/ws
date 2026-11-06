import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/domain/drafts.ts';

const d = (owner: string, discarded = false): D.DraftRow => ({ id: 1, documentId: 1, owner, note: '', fileName: 'x.docx', fileUrl: '#', checksum: '', createdAt: '2026-11-06', discarded });

test('a draft needs a file in an allowed format, and a short note', () => {
  assert.equal(D.draftErrors({ file: { name: 'mine.docx', size: 1000 }, note: 'edited section 3' }).file, undefined);
  assert.ok(D.draftErrors({ file: null, note: '' }).file);
  assert.ok(D.draftErrors({ file: { name: 'x.exe', size: 1 }, note: '' }).file);
  assert.ok(D.draftErrors({ file: { name: 'x.docx', size: 1 }, note: 'a'.repeat(201) }).note);
});

test('owner and editors see a draft; other members do not', () => {
  assert.equal(D.canSeeDraft(d('Sam'), 'Sam', false), true);
  assert.equal(D.canSeeDraft(d('Sam'), 'Priya', false), false);
  assert.equal(D.canSeeDraft(d('Sam'), 'Mia', true), true);
  assert.equal(D.canSeeDraft(d('Sam', true), 'Sam', true), false, 'discarded drafts are hidden');
});

test('only the owner or an editor can discard', () => {
  assert.equal(D.canDiscardDraft(d('Sam'), 'Sam', false), null);
  assert.match(D.canDiscardDraft(d('Sam'), 'Priya', false) as string, /Only the owner/);
  assert.equal(D.canDiscardDraft(d('Sam'), 'Mia', true), null);
  assert.match(D.canDiscardDraft(d('Sam', true), 'Sam', false) as string, /already/);
});
