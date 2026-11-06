/* Preview page: the real screens, fed by the in-memory register. */
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { MockRegister } from './mockRegister';
import { DocumentList } from '../src/components/DocumentList';
import { DocumentPage } from '../src/components/DocumentPage';
import { AddDocument } from '../src/components/AddDocument';
import { Btn, Notice, row, C } from '../src/components/ui';

type View = { kind: 'list' } | { kind: 'doc'; id: number } | { kind: 'add' } | { kind: 'log' };
const reg: any = new MockRegister();
const me = { name: 'Sam', isRecordsLead: false };
const projects = [{ code: 'U100', name: 'Unit 100 Refinery', status: 'active' as const, numberPattern: '{PROJ}-{TYPE}-{SEQ:4}' }, { code: 'TF7', name: 'Tank Farm TF-7', status: 'active' as const, numberPattern: '{PROJ}-{TYPE}-{SEQ:4}' }];
const members = ['Mia', 'Priya', 'Sam', 'Tom'];

function Preview() {
  const [view, setView] = React.useState<View>({ kind: 'list' });
  const [version, setVersion] = React.useState(0);
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 16, fontFamily: 'Segoe UI, system-ui, sans-serif', color: C.ink }}>
      <div style={{ ...row, justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: C.soft }}>Signed in as <b style={{ color: C.ink }}>Sam</b> (set by Windows sign-in)</div>
        <div style={row}>
          <Btn kind={view.kind === 'list' || view.kind === 'doc' || view.kind === 'add' ? 'primary' : 'plain'} onClick={() => setView({ kind: 'list' })}>Documents</Btn>
          <Btn kind={view.kind === 'log' ? 'primary' : 'plain'} onClick={() => setView({ kind: 'log' })}>Activity</Btn>
        </div>
      </div>
      {view.kind === 'list' ? <DocumentList key={version} reg={reg} projects={projects} onOpen={id => setView({ kind: 'doc', id })} onAdd={() => setView({ kind: 'add' })} /> : null}
      {view.kind === 'doc' ? <DocumentPage key={version + ':' + view.id} reg={reg} id={view.id} me={me} members={members} onBack={() => setView({ kind: 'list' })} onChanged={() => setVersion(v => v + 1)} /> : null}
      {view.kind === 'add' ? <AddDocument reg={reg} me={me} projects={projects} members={members} onCancel={() => setView({ kind: 'list' })} onDone={id => { setVersion(v => v + 1); setView({ kind: 'doc', id }); }} /> : null}
      {view.kind === 'log' ? <Log reg={reg} /> : null}
      <Notice tone="info">Preview with sample data. In SharePoint the same screens read and write your lists.</Notice>
    </div>
  );
}
function Log({ reg }: { reg: any }) {
  const [rows, setRows] = React.useState<any[]>([]);
  React.useEffect(() => { reg.audit(undefined, 200).then(setRows); }, []);
  return <div><h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Activity</h1>{rows.map(a => <div key={a.id} style={{ padding: '6px 0', borderBottom: `1px solid ${C.line}`, fontSize: 14 }}><span style={{ color: C.soft }}>{a.when.slice(0, 16).replace('T', ' ')} · {a.who}</span> <b>{a.action}</b> {a.docNumber} {a.detail}</div>)}</div>;
}
ReactDom.render(<Preview />, document.getElementById('root'));
