/* Helpers for values sent to SharePoint. Pure: no SharePoint calls. */

/* SharePoint rejects some characters in file names. Replace them and keep the name short. */
export function safeFileName(name: string): string {
  const cleaned = String(name || 'file')
    .replace(/[\\/:*?"<>|#%&{}~]/g, '_')
    .replace(/[\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  const dot = cleaned.lastIndexOf('.');
  const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const ext = dot > 0 ? cleaned.slice(dot) : '';
  return (base.slice(0, 120) || 'file') + ext.slice(0, 10);
}

/* Escape a value for use inside a single-quoted OData filter string. */
export function odataString(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/* Next version number for one period or certificate: one more than the highest used, or 1 if none. */
export function nextVersion(existing: number[]): number {
  return existing.length ? Math.max(...existing) + 1 : 1;
}
