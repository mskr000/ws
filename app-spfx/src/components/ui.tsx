import * as React from 'react';

/* Design tokens. Neutral greys, system font, blue accent, soft shadows, generous spacing. */
export const C = {
  ink: '#1d1d1f', soft: '#6e6e73', line: 'rgba(0,0,0,0.08)', lineStrong: '#d2d2d7', bg: '#f5f5f7', panel: '#ffffff',
  accent: '#0071e3', accentSoft: '#e8f1fc', ok: '#1d7f38', okSoft: '#e3f5e8', warn: '#a35200', warnSoft: '#fdf0df',
  bad: '#d70015', badSoft: '#fde8eb', mute: '#8e8e93', muteSoft: '#f0f0f3', fill: '#e8e8ed',
};
export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", system-ui, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.04)';

/* Hover and focus states that inline styles cannot express. Injected once by the app shell. */
export const GLOBAL_CSS = `
.dr .dr-icon { transition: background .15s ease; }
.dr .dr-icon:hover { background: ${C.accentSoft}; }
.dr .dr-icon:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
.dr { font-family: ${FONT}; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
.dr .dr-btn { transition: background .15s ease, box-shadow .15s ease, transform .05s ease; }
.dr .dr-btn:hover:not(:disabled) { filter: brightness(0.97); }
.dr .dr-btn:active:not(:disabled) { transform: scale(0.98); }
.dr .dr-link:hover { text-decoration: underline; }
.dr input.dr-field, .dr select.dr-field, .dr textarea.dr-field { transition: box-shadow .15s ease, border-color .15s ease; }
.dr input.dr-field:focus, .dr select.dr-field:focus, .dr textarea.dr-field:focus { outline: none; border-color: ${C.accent}; box-shadow: 0 0 0 4px rgba(0,113,227,0.18); }
.dr tr.dr-row { transition: background .12s ease; }
.dr tr.dr-row:hover td { background: ${C.bg}; }
.dr .dr-seg button { transition: background .15s ease, box-shadow .15s ease, color .15s ease; }
.dr .dr-seg button:focus-visible, .dr .dr-btn:focus-visible { outline: 3px solid rgba(0,113,227,0.45); outline-offset: 2px; }
.dr h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.022em; line-height: 1.15; margin: 0; }
.dr h2 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; margin: 30px 0 12px; }
.dr h3 { font-size: 15px; font-weight: 600; margin: 0; }
.dr section > h2:first-child, .dr section > div > h2:first-child { margin-top: 0; }
.dr ::selection { background: rgba(0,113,227,0.2); }
`;

export const card: React.CSSProperties = { background: C.panel, borderRadius: 16, padding: 22, marginBottom: 16, boxShadow: SHADOW };
export const input: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, borderRadius: 10, padding: '9px 12px', fontSize: 15, width: '100%', boxSizing: 'border-box', background: C.panel, color: C.ink, fontFamily: FONT };
export const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' };
export const hint: React.CSSProperties = { fontSize: 13, color: C.soft, lineHeight: 1.4 };
export const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: C.ink };

export function Title(props: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.022em', margin: 0, lineHeight: 1.15 }}>{props.children}</h1>
      {props.sub ? <p style={{ ...hint, fontSize: 15, margin: '6px 0 0', maxWidth: '70ch' }}>{props.sub}</p> : null}
    </div>
  );
}

export function Btn(props: { onClick?: () => void; kind?: 'primary' | 'ok' | 'danger' | 'link' | 'plain'; disabled?: boolean; children: React.ReactNode; type?: 'button' | 'submit' }) {
  const k = props.kind || 'plain';
  const base: React.CSSProperties = { borderRadius: 980, padding: k === 'link' ? '6px 6px' : '8px 18px', fontSize: 15, fontWeight: 500, fontFamily: FONT,
    cursor: props.disabled ? 'default' : 'pointer', opacity: props.disabled ? 0.4 : 1, border: 'none', background: C.fill, color: C.ink, whiteSpace: 'nowrap', lineHeight: 1.3 };
  if (k === 'primary') Object.assign(base, { background: C.accent, color: '#fff' });
  if (k === 'ok') Object.assign(base, { background: C.ok, color: '#fff' });
  if (k === 'danger') Object.assign(base, { background: C.badSoft, color: C.bad });
  if (k === 'link') Object.assign(base, { background: 'none', color: C.accent, fontWeight: 500, padding: '6px 4px' });
  const cls = k === 'link' ? 'dr-btn dr-link' : 'dr-btn';
  return <button type={props.type || 'button'} className={cls} style={base} disabled={props.disabled} onClick={props.onClick}>{props.children}</button>;
}

export function Pill(props: { tone?: 'ok' | 'wait' | 'bad' | 'check' | 'old' | 'none'; children: React.ReactNode }) {
  const t = props.tone || 'none';
  const map: Record<string, [string, string]> = { ok: [C.okSoft, C.ok], wait: [C.warnSoft, C.warn], bad: [C.badSoft, C.bad], check: [C.accentSoft, C.accent], old: [C.muteSoft, C.mute], none: [C.muteSoft, C.soft] };
  const [bg, fg] = map[t];
  return <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 980, background: bg, color: fg, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>{props.children}</span>;
}

export function Field(props: { label: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6, marginBottom: 16, minWidth: 0 }}>
      <label style={label}>{props.label}</label>
      {props.children}
      {props.help ? <div style={hint}>{props.help}</div> : null}
      {props.error ? <div style={{ fontSize: 13, color: C.bad }} role="alert">{props.error}</div> : null}
    </div>
  );
}

export function Notice(props: { tone: 'bad' | 'ok' | 'info' | 'warn'; children: React.ReactNode }) {
  const map = { bad: [C.badSoft, C.bad], ok: [C.okSoft, C.ok], info: [C.accentSoft, C.ink], warn: [C.warnSoft, C.ink] };
  const [bg, fg] = map[props.tone];
  return <div role={props.tone === 'bad' ? 'alert' : 'status'} style={{ background: bg, color: fg, borderRadius: 12, padding: '12px 14px', margin: '0 0 16px', fontSize: 14, lineHeight: 1.45 }}>{props.children}</div>;
}

export function Select(props: { value: string; onChange: (v: string) => void; options: Array<[string, string]>; placeholder?: string; disabled?: boolean; label?: string; width?: number }) {
  return (
    <select className="dr-field" aria-label={props.label} value={props.value} disabled={props.disabled} onChange={e => props.onChange(e.target.value)}
      style={{ ...input, width: props.width || 'auto', minWidth: 180, paddingRight: 30, appearance: 'auto' }}>
      <option value="">{props.placeholder || 'Choose…'}</option>
      {props.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/* Segmented control, the iOS style switch between sections. */
export function Segmented(props: { value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="dr-seg" role="tablist" style={{ display: 'inline-flex', background: C.fill, borderRadius: 10, padding: 2 }}>
      {props.options.map(([v, l]) => {
        const on = props.value === v;
        return <button key={v} role="tab" aria-selected={on} onClick={() => props.onChange(v)}
          style={{ border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: 'pointer', color: C.ink,
            background: on ? C.panel : 'transparent', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{l}</button>;
      })}
    </div>
  );
}

/* Section heading inside a page. */
export function Section(props: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section style={card}>
      <div style={{ ...row, justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>{props.title}</h2>
        {props.right}
      </div>
      {props.children}
    </section>
  );
}

/* Table wrapper with the soft card look. */
export function Table(props: { minWidth?: number; children: React.ReactNode }) {
  return <div style={{ background: C.panel, borderRadius: 16, boxShadow: SHADOW, overflowX: 'auto', marginBottom: 16 }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: props.minWidth || 600, fontSize: 15 }}>{props.children}</table>
  </div>;
}
export const th: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.soft, borderBottom: `1px solid ${C.line}` };
export const td: React.CSSProperties = { padding: '13px 16px', borderBottom: `1px solid ${C.line}`, verticalAlign: 'middle' };

/* Download icon: tray with an arrow. A link to the file, with a name for the saved copy. */
export function DownloadIcon(props: { href: string; fileName: string; label?: string }) {
  const label = props.label || `Download ${props.fileName}`;
  return (
    <a className="dr-icon" href={props.href} download={props.fileName} aria-label={label} title={label}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, color: C.accent, flex: '0 0 auto' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v11" /><path d="M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" />
      </svg>
    </a>
  );
}
