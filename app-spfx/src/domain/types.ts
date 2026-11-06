import type { DocKind, RevStatus } from './rules';

export interface ProjectInfo { code: string; name: string; status: 'active' | 'archived'; numberPattern: string; kind: 'standard' | 'internal'; owner: string }
export interface DocTypeInfo { code: string; label: string; kind: DocKind; folder: string; firstNumber: number }

export interface DocumentRow {
  id: number;
  number: string;
  title: string;
  project: string;
  type: string;
  kind: DocKind;
  folder: string;
  owner: string;
  removed: boolean;
  spName: string;
  dueDay: number | null;
  startPeriod: string | null;
  legalHold: boolean;
  holdReason: string;
}
export interface RevisionRow {
  id: number;
  documentId: number;
  n: number;
  status: RevStatus | 'Not on file';
  reason: string;
  summary: string;
  note: string;
  uploader: string;
  checker: string;
  approver: string;
  checkedBy: string;
  approvedBy: string;
  returnNote: string;
  fileName: string;
  fileUrl: string;
  checksum: string;
  createdAt: string;
}
export interface PeriodRow {
  id: number;
  documentId: number;
  periodKey: string;
  version: number;
  notNeeded: boolean;
  notNeededReason: string;
  summary: string;
  uploader: string;
  uploadedAt: string | null;
  fileUrl: string;
  replaceReason: string;
  checksum: string;
  fileName: string;
}
export interface CertRow {
  id: number;
  documentId: number;
  n: number;
  summary: string;
  expiresOn: string;
  uploader: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  checksum: string;
}
export type { DraftRow } from './drafts';
export interface AuditRow { id: number; when: string; who: string; action: string; docNumber: string; detail: string }
