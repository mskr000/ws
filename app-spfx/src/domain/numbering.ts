/* Numbering patterns. Ported from app/src/rules.js. Tokens: {PROJ} {TYPE} {SEQ:n} {YYYY}. */

export const DEFAULT_PATTERN = '{PROJ}-{TYPE}-{SEQ:4}';
export type DocKind = 'controlled' | 'periodic' | 'record' | 'working';

const TOKEN_RE = /\{(PROJ|TYPE|YYYY|SEQ(?::(\d))?)\}/g;

export function patternError(pattern: string): string | null {
  const p = String(pattern || '');
  if (!p) return 'Enter a numbering pattern.';
  if (p.length > 40) return 'Pattern is too long (40 characters at most).';
  const rest = p.replace(TOKEN_RE, '');
  if (/[{}]/.test(rest)) return 'Unknown token. Use {PROJ}, {TYPE}, {SEQ:4} or {YYYY}.';
  if (!/^[A-Za-z0-9\-._/]*$/.test(rest)) return 'Only letters, digits and - . _ / are allowed between tokens.';
  const seqs = [...p.matchAll(TOKEN_RE)].filter(m => m[1].startsWith('SEQ'));
  if (seqs.length !== 1) return 'The pattern needs exactly one {SEQ} token.';
  const w = seqs[0][2] ? Number(seqs[0][2]) : 4;
  if (w < 1 || w > 6) return 'Sequence width must be between 1 and 6 digits.';
  return null;
}

function escapeRe(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
function width(pattern: string): number {
  const m = [...pattern.matchAll(TOKEN_RE)].find(x => x[1].startsWith('SEQ'));
  return m && m[2] ? Number(m[2]) : 4;
}

export function formatNumber(pattern: string, a: { project: string; type: string; seq: number; year: number }): string {
  return pattern.replace(TOKEN_RE, (_m: string, tok: string, w?: string) => {
    if (tok === 'PROJ') return a.project;
    if (tok === 'TYPE') return a.type;
    if (tok === 'YYYY') return String(a.year);
    return String(a.seq).padStart(Number(w || 4), '0');
  });
}

/* Matches numbers made from this pattern for one project and type. Captures the sequence. */
export function numberRegex(pattern: string, a: { project: string; type: string }): RegExp {
  let out = '^';
  let last = 0;
  for (const m of pattern.matchAll(TOKEN_RE)) {
    out += escapeRe(pattern.slice(last, m.index));
    const tok = m[1];
    if (tok === 'PROJ') out += escapeRe(a.project);
    else if (tok === 'TYPE') out += escapeRe(a.type);
    else if (tok === 'YYYY') out += '\\d{4}';
    else out += `(\\d{${width(pattern)},})`;
    last = (m.index as number) + m[0].length;
  }
  out += escapeRe(pattern.slice(last)) + '$';
  return new RegExp(out);
}

/* Next number: continues from the highest sequence used for this project and type, or from the first number. */
export function nextNumber(a: { pattern: string; project: string; type: string; existing: string[]; firstNumber?: number; year?: number }): string {
  const re = numberRegex(a.pattern, { project: a.project, type: a.type });
  let max = 0;
  for (const n of a.existing) {
    const m = re.exec(n);
    if (m) {
      const v = Number(m[1]);
      if (Number.isInteger(v) && v > max) max = v;
    }
  }
  const seq = Math.max(max + 1, a.firstNumber || 1);
  return formatNumber(a.pattern, { project: a.project, type: a.type, seq, year: a.year || new Date().getUTCFullYear() });
}
