/* Preview page. Renders the real App component. Only the data source is replaced by sample data. */
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App } from '../src/components/App';
import { MockRegister, signInAs, PREVIEW_PEOPLE } from './mockRegister';
import { Register } from '../src/services/register';
import { C, FONT, Segmented, GLOBAL_CSS, hint } from '../src/components/ui';

function Preview() {
  const [who, setWho] = React.useState('Sam');
  const [mock] = React.useState(() => new MockRegister());
  const choose = (name: string) => { signInAs(name); setWho(name); };
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT, color: C.ink }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 20px 48px' }}>
        <div style={{ background: C.panel, borderRadius: 16, padding: '14px 18px', marginBottom: 22, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, color: C.soft, marginBottom: 10 }}>Preview with sample data. This is the real web part. In SharePoint, Windows sign-in sets who you are.</div>
          <Segmented value={who} onChange={choose} options={PREVIEW_PEOPLE.map(p => [p, p === 'Mia' ? 'Mia · Records Lead' : p])} />
          <div style={{ ...hint, marginTop: 8 }}>Sam adds files. Mia can also add projects and remove documents.</div>
        </div>
        <App key={who} context={null} siteUrl="https://preview.example/sites/DocumentRegister" registerFactory={() => mock as unknown as Register} />
      </div>
    </div>
  );
}
ReactDom.render(<Preview />, document.getElementById('root'));
