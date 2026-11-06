/* Working drafts: a person's own copy of a document, for editing or review together.
   A draft is not a revision. It is not checked or approved. Visible to its owner and to anyone who can edit any document. */
// .ts extension so Node's test runner can load it (see dashboard.ts).
// @ts-ignore
import * as R from './rules.ts';

export interface DraftRow {
  id: number; documentId: number; owner: string; note: string;
  fileName: string; fileUrl: string; checksum: string; createdAt: string; discarded: boolean;
}

export const DRAFT_NOTE_MAX = 200;

export function draftErrors(i: { file: { name: string; size: number } | null; note: string }): R.Errors {
  const e: R.Errors = { ...R.fileErrors(i.file) };
  if ((i.note || '').length > DRAFT_NOTE_MAX) e.note = `Keep the note under ${DRAFT_NOTE_MAX} characters.`;
  return e;
}

/* The owner always sees their own drafts. Anyone who can edit any document sees all drafts. */
export function canSeeDraft(d: DraftRow, actor: string, canEditAny: boolean): boolean {
  return !d.discarded && (d.owner === actor || canEditAny);
}

export function canDiscardDraft(d: DraftRow, actor: string, canEditAny: boolean): string | null {
  if (d.discarded) return 'This draft is already discarded.';
  if (d.owner === actor || canEditAny) return null;
  return 'Only the owner of a draft, or someone who can edit any document, can discard it.';
}
