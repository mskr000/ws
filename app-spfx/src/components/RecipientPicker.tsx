import * as React from 'react';
import * as K from '../domain/contacts';
import { Register } from '../services/register';
import { Btn, Field, Notice, input, row, card, C, hint, Section } from './ui';

/* Pick people from saved companies, or add a new person. Selected people show as cards. */
export function RecipientPicker(props: { reg: Register; selected: number[]; setSelected: (ids: number[]) => void; onSelectedChange?: (r: K.Contact[]) => void }) {
  const [all, setAll] = React.useState<K.Contact[]>([]);
  const [company, setCompany] = React.useState('');
  const [findCo, setFindCo] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [f, setF] = React.useState({ company: '', name: '', email: '' });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [err, setErr] = React.useState('');

  const load = React.useCallback(() => {
    props.reg.contacts().then(cs => {
      setAll(cs);
      setCompany(c => c || K.companiesOf(cs)[0] || '');
    }).catch(e => setErr(String((e as Error).message || e)));
  }, [props.reg]);
  React.useEffect(() => { load(); }, [load]);

  const companies = K.companiesOf(all);
  const people = company ? K.peopleOf(all, company) : [];
  const chosen = K.recipientsOf(all, props.selected);
  React.useEffect(() => { props.onSelectedChange?.(chosen.people); }, [props.selected, all]);

  const toggle = (id: number) => props.setSelected(props.selected.includes(id) ? props.selected.filter(x => x !== id) : [...props.selected, id]);
  const everyoneIn = people.length > 0 && people.every(p => props.selected.includes(p.id));
  const selectCompany = () => props.setSelected(everyoneIn
    ? props.selected.filter(id => !people.some(p => p.id === id))
    : Array.from(new Set([...props.selected, ...people.map(p => p.id)])));

  const save = async () => {
    setErr('');
    const e = K.contactErrors(f, all);
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await props.reg.addContact({ company: f.company, name: f.name, email: f.email });
      setCompany(f.company.trim());
      setF({ company: '', name: '', email: '' });
      setAdding(false);
      load();
    } catch (x) { setErr(String((x as Error).message || x)); }
  };
  const remove = async (c: K.Contact) => {
    try { await props.reg.removeContact(c); props.setSelected(props.selected.filter(id => id !== c.id)); load(); }
    catch (x) { setErr(String((x as Error).message || x)); }
  };

  return (
    <Section title="Recipients">
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <div style={card}>
        <div style={{ ...row, alignItems: 'flex-end' }}>
          <div style={{ width: 300, maxWidth: '100%' }}>
            <input aria-label="Find a company" value={findCo} onChange={e => setFindCo(e.target.value)} placeholder={`Find one of ${companies.length} companies…`}
              style={{ ...input, height: 40, boxSizing: 'border-box', padding: '0 12px', marginBottom: 6 }} />
            <div role="listbox" aria-label="Companies" style={{ maxHeight: 150, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel }}>
              {companies.filter(c => c.toLowerCase().includes(findCo.trim().toLowerCase())).map(c => {
                const n = K.peopleOf(all, c).length;
                const on = c === company;
                const picked = K.peopleOf(all, c).filter(p => props.selected.includes(p.id)).length;
                return (
                  <button key={c} type="button" role="option" aria-selected={on} onClick={() => setCompany(c)}
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, border: 'none', borderBottom: `1px solid ${C.line}`, padding: '8px 12px', background: on ? C.accentSoft : 'transparent', color: on ? C.accent : C.ink, fontWeight: on ? 600 : 400, cursor: 'pointer', fontSize: 14, textAlign: 'left' }}>
                    <span>{c}</span>
                    <span style={{ color: C.soft, fontWeight: 400, fontSize: 13 }}>{picked ? `${picked} of ${n} selected` : `${n} ${n === 1 ? 'person' : 'people'}`}</span>
                  </button>
                );
              })}
              {companies.length === 0 ? <div style={{ padding: 12, color: C.soft, fontSize: 14 }}>No companies yet.</div> : null}
            </div>
          </div>
          <Btn disabled={!people.length} onClick={selectCompany}>{everyoneIn ? 'Clear this company' : `Select everyone at ${company || 'this company'}`}</Btn>
          <Btn onClick={() => { setAdding(a => !a); setErrors({}); setF({ company, name: '', email: '' }); }}>{adding ? 'Cancel' : '+ Add company or person'}</Btn>
        </div>

        {people.length ? (
          <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
            {people.map(p => (
              <label key={p.id} style={{ ...row, flexWrap: 'nowrap', padding: '8px 10px', borderRadius: 10, background: props.selected.includes(p.id) ? C.accentSoft : C.bg, cursor: 'pointer' }}>
                <input type="checkbox" aria-label={`Send to ${p.name}`} checked={props.selected.includes(p.id)} onChange={() => toggle(p.id)} />
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span style={{ color: C.soft, fontSize: 14, flex: 1 }}>{p.email}</span>
                <Btn kind="link" label={`Remove ${p.name} from the list`} onClick={() => remove(p)}>Remove</Btn>
              </label>
            ))}
          </div>
        ) : companies.length ? <div style={{ ...hint, marginTop: 10 }}>No people at this company.</div> : <div style={{ ...hint, marginTop: 10 }}>No companies saved yet. Add one below.</div>}

        {adding ? (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
            <div style={{ ...row, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 180px' }}><Field label="Company" error={errors.company}><input aria-label="New company" list="companies" value={f.company} onChange={e => setF({ ...f, company: e.target.value })} style={input} /></Field></div>
              <div style={{ flex: '1 1 180px' }}><Field label="Person's name" error={errors.name}><input aria-label="New person name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} style={input} /></Field></div>
              <div style={{ flex: '1 1 220px' }}><Field label="Email" error={errors.email}><input aria-label="New person email" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="name@company.com" style={input} /></Field></div>
            </div>
            <datalist id="companies">{companies.map(c => <option key={c} value={c} />)}</datalist>
            <Btn kind="primary" onClick={save}>Save person</Btn>
          </div>
        ) : null}
      </div>

      <div style={{ ...card, background: chosen.people.length ? C.panel : C.bg }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>
          {chosen.people.length === 0 ? 'Nobody selected yet' : `Sending to ${chosen.people.length} ${chosen.people.length === 1 ? 'person' : 'people'}${chosen.companies.length ? ` at ${chosen.companies.length} ${chosen.companies.length === 1 ? 'company' : 'companies'}` : ''}`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
          {chosen.people.map(p => (
            <div key={p.id} style={{ border: `1px solid ${C.lineStrong}`, borderRadius: 12, padding: '10px 12px', position: 'relative', background: C.panel }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: C.soft, wordBreak: 'break-all' }}>{p.email}</div>
              <div style={{ fontSize: 12, color: C.soft, marginTop: 4 }}>{p.company}</div>
              <button type="button" aria-label={`Take ${p.name} off this send`} onClick={() => toggle(p.id)}
                style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'none', color: C.soft, fontSize: 16, cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
