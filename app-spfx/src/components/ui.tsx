import * as React from 'react';

export const C = { ink: '#1c2631', soft: '#5d6874', line: '#e2ded5', bg: '#f3f1ec', panel: '#ffffff', accent: '#1f5f8b',
  accentSoft: '#e1ecf5', ok: '#23734a', okSoft: '#dff2e7', warn: '#8f5a00', warnSoft: '#fbefd6', bad: '#a02f2f', badSoft: '#f8e2e2', mute: '#7d8790', muteSoft: '#eceae5' };

export const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 14 };
export const input: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', fontSize: 14, width: '100%', boxSizing: 'border-box', background: C.panel, color: C.ink };
export const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' };

export function Btn(props: { onClick?: () => void; kind?: 'primary' | 'ok' | 'danger' | 'link' | 'plain'; disabled?: boolean; children: React.ReactNode; type?: 'button' | 'submit' }) {
  const k = props.kind || 'plain';
  const base: React.CSSProperties = { borderRadius: 8, padding: k === 'link' ? '6px 4px' : '8px 14px', fontSize: 14, fontWeight: 600, cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? 0.45 : 1,
    border: `1px solid ${k === 'link' ? 'transparent' : C.line}`, background: C.panel, color: C.ink };
  if (k === 'primary') Object.assign(base, { background: C.accent, borderColor: C.accent, color: '#fff' });
  if (k === 'ok') Object.assign(base, { background: C.ok, borderColor: C.ok, color: '#fff' });
  if (k === 'danger') Object.assign(base, { borderColor: C.bad, color: C.bad });
  if (k === 'link') Object.assign(base, { background: 'none', color: C.accent });
  return <button type={props.type || 'button'} style={base} disabled={props.disabled} onClick={props.onClick}>{props.children}</button>;
}

export function Pill(props: { tone?: 'ok' | 'wait' | 'bad' | 'check' | 'old' | 'none'; children: React.ReactNode }) {
  const t = props.tone || 'none';
  const map: Record<string, [string, string]> = { ok: [C.okSoft, C.ok], wait: [C.warnSoft, C.warn], bad: [C.badSoft, C.bad], check: [C.accentSoft, C.accent], old: [C.muteSoft, C.mute], none: [C.muteSoft, C.soft] };
  const [bg, fg] = map[t];
  return <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 650, padding: '2px 9px', borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap' }}>{props.children}</span>;
}

export function Field(props: { label: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 650 }}>{props.label}</label>
      {props.children}
      {props.help ? <div style={{ fontSize: 12.5, color: C.soft }}>{props.help}</div> : null}
      {props.error ? <div style={{ fontSize: 13, color: C.bad }} role="alert">{props.error}</div> : null}
    </div>
  );
}

export function Notice(props: { tone: 'bad' | 'ok' | 'info' | 'warn'; children: React.ReactNode }) {
  const map = { bad: [C.badSoft, C.bad], ok: [C.okSoft, C.ok], info: [C.accentSoft, C.ink], warn: [C.warnSoft, C.ink] };
  const [bg, fg] = map[props.tone];
  return <div role={props.tone === 'bad' ? 'alert' : 'status'} style={{ background: bg, color: fg, borderRadius: 10, padding: '10px 12px', margin: '0 0 12px', fontSize: 14 }}>{props.children}</div>;
}

export function Select(props: { value: string; onChange: (v: string) => void; options: Array<[string, string]>; placeholder?: string; disabled?: boolean; label?: string }) {
  return (
    <select aria-label={props.label} value={props.value} disabled={props.disabled} onChange={e => props.onChange(e.target.value)} style={{ ...input, width: 'auto', minWidth: 160 }}>
      <option value="">{props.placeholder || 'Choose…'}</option>
      {props.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
