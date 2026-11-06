/* Preview page. Renders the real App component. Only the data source is replaced by sample data. */
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App } from '../src/components/App';
import { MockRegister, signInAs, PREVIEW_PEOPLE } from './mockRegister';
import { Register } from '../src/services/register';
import { C } from '../src/components/ui';

function Preview() {
  const [who, setWho] = React.useState('Sam');
  const [mock] = React.useState(() => new MockRegister());
  const choose = (name: string) => { signInAs(name); setWho(name); };
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16, fontFamily: 'Segoe UI, system-ui, sans-serif', color: C.ink }}>
      <div style={{ background: C.accentSoft, borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
        <b>Preview.</b> This is the real web part screens with sample data. Switch the person below. In SharePoint, Windows sign-in sets who you are.
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PREVIEW_PEOPLE.map(p => (
            <button key={p} onClick={() => choose(p)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: who === p ? C.accent : '#fff', color: who === p ? '#fff' : C.ink, cursor: 'pointer' }}>
              {p}{p === 'Mia' ? ' (Records Lead)' : ''}
            </button>
          ))}
        </div>
      </div>
      <App key={who} context={null} siteUrl="https://preview.example/sites/DocumentRegister" registerFactory={() => mock as unknown as Register} />
    </div>
  );
}
ReactDom.render(<Preview />, document.getElementById('root'));
