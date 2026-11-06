/* Audit export. One CSV line per entry, oldest first, so it reads like a log. */
// @ts-ignore .ts extension so Node's test runner can load it (see dashboard.ts).
import { csvCell } from './transmittal.ts';

export interface AuditExportRow { when: string; who: string; action: string; docNumber: string; detail: string }

export function auditCsv(rows: AuditExportRow[]): string {
  const head = ['When (UTC)', 'Who', 'Action', 'Document', 'Detail'];
  const body = [...rows].sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : 0))
    .map(r => [r.when, r.who, r.action, r.docNumber, r.detail]);
  return [head, ...body].map(r => r.map(csvCell).join(',')).join('\r\n');
}
