import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/domain/mail.ts';
import { textPdf } from '../src/domain/pdf.ts';

test('undo works for 60 seconds from the moment it is held, then not', () => {
  const held = '2026-11-06T10:00:00Z';
  assert.equal(M.canUndo(held, '2026-11-06T10:00:30Z'), true);
  assert.equal(M.canUndo(held, '2026-11-06T10:01:00Z'), false);
  assert.equal(M.secondsLeft(held, '2026-11-06T10:00:50Z'), 10);
});

test('email addresses are checked before anything is held', () => {
  assert.equal(M.validEmail('client@example.com'), true);
  assert.equal(M.validEmail('client@example'), false);
  assert.equal(M.validEmail('not an email'), false);
});

test('the message carries recipient, subject, body and attachments', () => {
  const g = M.graphMessage({ to: ' a@b.co ', subject: 'S', body: 'B', attachments: [{ name: 'x.csv', contentType: 'text/csv', base64: 'AA==' }] });
  assert.equal(g.message.toRecipients[0].emailAddress.address, 'a@b.co');
  assert.equal(g.message.attachments[0].name, 'x.csv');
  assert.equal(g.saveToSentItems, true);
});

test('the PDF is a real PDF with the text in it and a correct page count', () => {
  const bytes = textPdf('Transmittal TX-U100-0001', ['To: Client A', 'U100-PID-1001 Pump layout']);
  const s = new TextDecoder('latin1').decode(bytes);
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.includes('(Transmittal TX-U100-0001) Tj'));
  assert.ok(s.includes('/Count 1'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  const many = textPdf('T', Array.from({ length: 100 }, (_, i) => `line ${i}`));
  assert.ok(new TextDecoder('latin1').decode(many).includes('/Count 3'));
});

test('PDF text escapes brackets and backslashes', () => {
  const s = new TextDecoder('latin1').decode(textPdf('a (b) c\\d', []));
  assert.ok(s.includes('a \\(b\\) c\\\\d'));
});
