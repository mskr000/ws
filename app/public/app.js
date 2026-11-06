/* Document Register front end. Talks only to /api. All rules are enforced by the server; this page only shows results. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { me: localStorage.getItem('dms.me') || '', users: [], projects: [], types: [], tab: 'docs', view: 'list', open: null,
    filter: { project: '', cls: '', q: '' }, modal: null, errors: {}, draft: {} };
  const CLS = { controlled: 'Controlled', periodic: 'Recurring', record: 'Certificate' };
  const PSTATE = { on_time: ['c-on_time', 'On time'], late: ['c-late', 'Late'], missing: ['c-missing', 'Missing'], open: ['c-open', 'Open'], not_needed: ['c-not_needed', 'Not needed'], upcoming: ['c-upcoming', ''], not_started: ['c-upcoming', ''] };
  const RSTATE = { valid: ['p-ok', 'Valid'], expiring: ['p-wait', 'Expiring soon'], expired: ['p-bad', 'Expired'], none: ['p-none', 'None'] };
  const REV = { Submitted: ['p-wait', 'Waiting for check'], Checked: ['p-check', 'Waiting for approval'], Approved: ['p-ok', 'Approved'], Returned: ['p-bad', 'Sent back'] };
  const REASONS = ['Design change', 'Client comment', 'Vendor data', 'Error fix', 'Scope change', 'As-built'];

  async function api(method, url, body, as) {
    const opt = { method, headers: { 'X-Actor': as || S.me } };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const res = await fetch(url, opt);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || 'Request failed.'); e.fields = data.fields || null; throw e; }
    return data;
  }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 4500);
  }
  function fileToBody(input) {
    return new Promise((resolve, reject) => {
      const f = input && input.files && input.files[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve({ name: f.name, base64: String(r.result).split(',')[1] });
      r.onerror = () => reject(new Error('Could not read the file.'));
      r.readAsDataURL(f);
    });
  }
  function errs(fields) {
    if (!fields) return '';
    return `<div class="errbox">${Object.values(fields).map(esc).join('<br>')}</div>`;
  }
  function today() { return new Date().toISOString().slice(0, 10); }

  /* ---------- Sign-in ---------- */
  async function boot() {
    const names = await fetch('/api/signin').then(r => r.json()).catch(() => []);
    if (!names.length) { $('#main').innerHTML = '<p style="padding:20px">The server is not running. Start it, then reload.</p>'; return; }
    S.users = await api('GET', '/api/users', undefined, names[0]);
    if (!names.includes(S.me)) S.me = names[0];
    $('#who').innerHTML = names.map(n => `<option ${n === S.me ? 'selected' : ''}>${esc(n)}</option>`).join('');
    S.projects = await api('GET', '/api/projects');
    S.types = await api('GET', '/api/types');
    render();
  }
  $('#who').addEventListener('change', e => { S.me = e.target.value; localStorage.setItem('dms.me', S.me); render(); });
  document.querySelectorAll('[role=tab]').forEach(b => b.addEventListener('click', () => {
    S.tab = b.dataset.tab; S.view = 'list'; S.open = null; render();
  }));

  /* ---------- Views ---------- */
  async function render() {
    document.querySelectorAll('[role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab));
    try {
      if (S.tab === 'audit') return renderAudit();
      if (S.tab === 'projects') return renderProjects();
      if (S.view === 'doc') return renderDoc();
      return renderList();
    } catch (e) { $('#main').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
  }
  async function renderList() {
    const qs = new URLSearchParams();
    if (S.filter.project) qs.set('project', S.filter.project);
    if (S.filter.cls) qs.set('cls', S.filter.cls);
    if (S.filter.q) qs.set('q', S.filter.q);
    const docs = await api('GET', '/api/documents?' + qs.toString());
    $('#main').innerHTML = `
      <h1>Documents</h1><p class="sub">Signed in as <b>${esc(S.me)}</b>. Open a document to work on it.</p>
      <div class="row" style="margin-bottom:10px">
        <input id="q" class="t" type="search" placeholder="Search number or title" value="${esc(S.filter.q)}" style="max-width:280px;flex:1" aria-label="Search">
        <select id="fp" class="t" style="width:auto" aria-label="Project"><option value="">All projects</option>${S.projects.map(p => `<option value="${p.code}" ${S.filter.project === p.code ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <select id="fc" class="t" style="width:auto" aria-label="Kind"><option value="">All kinds</option>${Object.entries(CLS).map(([k, v]) => `<option value="${k}" ${S.filter.cls === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <span class="grow"></span><button class="btn primary" id="new">+ New document</button>
      </div>
      <div class="tw"><table><thead><tr><th>Number</th><th>Title</th><th>Kind</th><th>Folder</th><th>Where it stands</th></tr></thead><tbody>
      ${docs.length ? docs.map(d => `<tr class="click" data-id="${d.id}"><td class="no">${esc(d.number)}${d.deleted ? ' <span class="pill p-bad">Removed</span>' : ''}</td>
        <td><b>${esc(d.title)}</b></td><td><span class="cls">${CLS[d.cls]}</span></td><td class="small muted">${esc(d.folder.split('/').join(' › '))}</td>
        <td>${stands(d)}</td></tr>`).join('') : '<tr><td colspan="5" class="muted" style="padding:20px;text-align:center">No documents match.</td></tr>'}
      </tbody></table></div>`;
    $('#q').oninput = e => { S.filter.q = e.target.value; renderList(); };
    $('#fp').onchange = e => { S.filter.project = e.target.value; renderList(); };
    $('#fc').onchange = e => { S.filter.cls = e.target.value; renderList(); };
    $('#new').onclick = () => openNew();
    document.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => { S.open = Number(tr.dataset.id); S.view = 'doc'; render(); });
  }
  function stands(d) {
    if (d.cls === 'controlled') return d.current != null ? `Current: Rev ${d.current}` : '<span class="muted">No approved version</span>';
    if (d.cls === 'periodic') return d.thisMonth ? (PSTATE[d.thisMonth.state] || [0, d.thisMonth.state])[1] || 'Not yet due' : '';
    const r = RSTATE[d.status] || RSTATE.none;
    return `<span class="pill ${r[0]}">${r[1]}</span>${d.expiresOn ? ' <span class="small muted">expires ' + esc(d.expiresOn) + '</span>' : ''}`;
  }

  async function renderDoc() {
    const d = await api('GET', '/api/documents/' + S.open);
    const dl = (name, sha) => `<a class="btn link" href="/api/files/${sha}?name=${encodeURIComponent(name)}" download>Download ${esc(name)}</a>`;
    let body = '';
    if (d.cls === 'controlled') {
      const cur = d.revisions.find(r => r.n === d.current);
      body = `<h2>Revisions</h2><div class="card">${d.revisions.slice().reverse().map(r => {
        const acts = [];
        if (r.status === 'Submitted') acts.push(`<button class="btn ok" data-act="check" data-id="${r.id}">Check</button>`);
        if (r.status === 'Checked') acts.push(`<button class="btn ok" data-act="approve" data-id="${r.id}">Approve</button>`);
        if (['Submitted', 'Checked'].includes(r.status)) acts.push(`<input class="t" style="max-width:280px" id="rt${r.id}" placeholder="Why? (10+ characters)"><button class="btn danger" data-act="return" data-id="${r.id}">Send back</button>`);
        return `<div class="rev ${cur && cur.n === r.n ? 'cur' : ''}"><div class="dot"></div><div>
          <div class="row"><b>Rev ${r.n}</b><span class="pill ${(REV[r.status] || ['p-none'])[0]}">${(REV[r.status] || [0, r.status])[1]}</span>${cur && cur.n === r.n ? '<span class="pill p-ok">Current</span>' : ''}</div>
          <div class="small muted">${esc(r.createdAt.slice(0, 10))} · added by ${esc(r.by)} · ${esc(r.reason)} · checker ${esc(r.checker)} · approver ${esc(r.approver)}</div>
          <div class="rs">${esc(r.summary)}</div>
          ${r.returnNote ? `<div class="warnbox">Sent back: ${esc(r.returnNote)}</div>` : ''}
          <div class="small">${dl(r.fileName, r.sha256)}</div>
          ${acts.length ? `<div class="ra">${acts.join(' ')}</div>` : ''}</div></div>`;
      }).join('') || '<span class="muted">None yet.</span>'}</div>
      <h2>Add a revision</h2><div class="card">${revForm()}</div>`;
    } else if (d.cls === 'periodic') {
      body = `<h2>Months</h2><div class="tw"><table><thead><tr><th>Period</th><th>Due</th><th>Status</th><th>Uploaded by</th><th>Summary</th><th></th></tr></thead><tbody>
        ${d.periods.map(p => `<tr><td class="no">${p.period}</td><td>${esc(p.due || '')}</td><td><span class="pill">${(PSTATE[p.state] || [0, p.state])[1]}</span></td>
          <td>${esc(p.by || '—')}</td><td class="small">${esc(p.summary || (p.na ? 'Not needed: ' + p.naReason : ''))}</td>
          <td><button class="btn" data-act="period" data-period="${p.period}">${p.by ? 'Replace' : 'Upload'}</button>
          <button class="btn link" data-act="na" data-period="${p.period}">Not needed</button></td></tr>`).join('')}
        </tbody></table></div><div id="periodForm"></div>`;
    } else {
      body = `<h2>Current certificate</h2><div class="card">${d.versions[0] ? `<b>Expires ${esc(d.versions[0].expiresOn)}</b><div class="rs">${esc(d.versions[0].summary)}</div><div class="small">${dl(d.versions[0].fileName, d.versions[0].sha256)}</div>` : 'None'}</div>
        <h2>Renew</h2><div class="card">${renewForm()}</div>
        <h2>Earlier versions</h2><div class="card">${d.versions.slice(1).map(v => `<div>Version ${v.n} · expired ${esc(v.expiresOn)} · ${esc(v.summary)} ${dl(v.fileName, v.sha256)}</div>`).join('') || '<span class="muted">None.</span>'}</div>`;
    }
    const me = S.users.find(u => u.name === S.me);
    const removeBlock = d.deleted
      ? `<div class="warnbox">Removed. File renamed to <span class="no">${esc(d.spName)}</span>. Nothing erased.</div>${me && me.role === 'admin' ? '<button class="btn ok" id="restore">Restore</button>' : ''}`
      : `<div id="removeBox">${me && me.role === 'admin' ? '<button class="btn danger" id="removeOpen">Remove document</button> <span class="small muted">Records lead only. Nothing is erased.</span>' : '<span class="small muted">Only the records lead can remove a document.</span>'}</div>`;
    $('#main').innerHTML = `<button class="btn link" id="back" style="padding-left:0">← All documents</button>
      <h1 style="margin-top:6px">${esc(d.title)}</h1>
      <p class="sub"><span class="no">${esc(d.number)}</span> · <span class="cls">${CLS[d.cls]}</span> · ${esc(d.folder.split('/').join(' › '))} · Owner ${esc(d.owner)}</p>
      <div id="flash"></div>${body}
      <h2>Remove</h2>${removeBlock}
      <h2>Activity</h2><div class="card log" id="actLog">Loading…</div>`;
    $('#back').onclick = () => { S.view = 'list'; S.open = null; render(); };
    loadDocAudit(d.id);
    bindDoc(d);
  }
  async function loadDocAudit(id) {
    const rows = await api('GET', '/api/audit?document=' + id);
    const el = $('#actLog'); if (!el) return;
    el.innerHTML = rows.slice(0, 20).map(r => `<div><span class="muted">${esc(r.at.replace('T', ' ').slice(0, 16))} · ${esc(r.who)}</span><span>${esc(r.action)}: ${esc(r.detail)}</span></div>`).join('') || '<span class="muted">Nothing yet.</span>';
  }
  function revForm() {
    const f = S.draft.rev || {};
    return `${errs(S.errors.rev)}
      <div class="field"><label>File <span class="err">*</span></label><input type="file" id="rfile"></div>
      <div class="two"><div class="field"><label>Reason</label><select class="t" id="rreason">${REASONS.map(r => `<option ${f.reason === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label>Checker</label><select class="t" id="rchk">${personOpts(f.checker)}</select></div></div>
      <div class="field"><label>Approver</label><select class="t" id="rapp">${personOpts(f.approver)}</select></div>
      <div class="field"><label>One-line summary</label><input class="t" id="rsum" value="${esc(f.summary || '')}" placeholder="What changed, and why?"></div>
      <div class="field"><label>Note for the checker</label><textarea class="t" id="rnote">${esc(f.note || '')}</textarea></div>
      <div class="row"><button class="btn primary" id="rsave">Send for check</button></div>`;
  }
  function renewForm() {
    const f = S.draft.renew || {};
    return `${errs(S.errors.renew)}
      <div class="field"><label>File</label><input type="file" id="nfile"></div>
      <div class="field"><label>New expiry date</label><input type="date" class="t" id="nexp" value="${esc(f.expiresOn || '')}" min="${today()}"></div>
      <div class="field"><label>One-line summary</label><input class="t" id="nsum" value="${esc(f.summary || '')}" placeholder="For example: renewed after inspection"></div>
      <div class="row"><button class="btn primary" id="nsave">Save renewal</button></div>`;
  }
  function personOpts(sel) {
    return '<option value="">Choose…</option>' + S.users.map(u => `<option ${u.name === sel ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
  }
  function bindDoc(d) {
    const act = async (fn, okMsg) => {
      try { await fn(); toast(okMsg); await renderDoc(); }
      catch (e) { $('#flash').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
    document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const id = b.dataset.id, a = b.dataset.act;
      if (a === 'check') return act(() => api('POST', `/api/revisions/${id}/check`), 'Checked.');
      if (a === 'approve') return act(() => api('POST', `/api/revisions/${id}/approve`), 'Approved. It is now current.');
      if (a === 'return') return act(() => api('POST', `/api/revisions/${id}/return`, { text: $('#rt' + id).value }), 'Sent back.');
      if (a === 'period') return openPeriod(d, b.dataset.period);
      if (a === 'na') return openPeriod(d, b.dataset.period, true);
    });
    const save = $('#rsave');
    if (save) save.onclick = async () => {
      try {
        const file = await fileToBody($('#rfile'));
        S.errors.rev = null;
        await api('POST', `/api/documents/${d.id}/revisions`, { file, reason: $('#rreason').value, checker: $('#rchk').value, approver: $('#rapp').value, summary: $('#rsum').value, note: $('#rnote').value });
        toast('Sent for check.'); renderDoc();
      } catch (e) { S.errors.rev = e.fields ? Object.values(e.fields) : [e.message]; $('#main').querySelector('h2 + .card').innerHTML = revForm(); bindDoc(d); }
    };
    const ren = $('#nsave');
    if (ren) ren.onclick = async () => {
      try {
        const file = await fileToBody($('#nfile'));
        await api('POST', `/api/documents/${d.id}/renew`, { file, expiresOn: $('#nexp').value, summary: $('#nsum').value });
        toast('Renewal saved.'); renderDoc();
      } catch (e) { $('#flash').innerHTML = errs(e.fields) || `<div class="errbox">${esc(e.message)}</div>`; }
    };
    const ro = $('#removeOpen');
    if (ro) ro.onclick = () => {
      $('#removeBox').innerHTML = `<div class="warnbox">The document is hidden. Its file is renamed to DELETED_…. Nothing is erased.</div>
        <div class="two"><select class="t" id="rr"><option value="">Choose a reason…</option><option>Duplicate of another record</option><option>Created in error</option><option>No longer needed</option></select>
        <input class="t" id="rtxt" placeholder="Why, in a sentence (20+ characters)"></div>
        <div class="row"><button class="btn danger" id="rgo">Remove</button><button class="btn link" id="rcancel">Cancel</button></div>`;
      $('#rcancel').onclick = () => renderDoc();
      $('#rgo').onclick = () => act(() => api('POST', `/api/documents/${d.id}/remove`, { reason: $('#rr').value, text: $('#rtxt').value }), 'Removed. Renamed, not erased.');
    };
    const rs = $('#restore');
    if (rs) rs.onclick = () => act(() => api('POST', `/api/documents/${d.id}/restore`), 'Restored.');
    const ed = document.querySelector('#main h2 + .card');
  }
  function openPeriod(d, period, na) {
    const box = $('#periodForm');
    box.innerHTML = `<h2>${na ? 'Mark ' + period + ' not needed' : 'Upload ' + period}</h2><div class="card">
      <div id="pflash"></div>
      ${na ? `<div class="field"><label>Why is it not needed?</label><input class="t" id="pna" placeholder="At least 10 characters"></div>`
        : `<div class="field"><label>File</label><input type="file" id="pfile"></div>
           <div class="field"><label>One-line summary</label><input class="t" id="psum" placeholder="What does this month show?"></div>
           <div class="field"><label>Why replace it? (only if one is already uploaded)</label><input class="t" id="prep" placeholder="Leave empty for a first upload"></div>`}
      <div class="row"><button class="btn primary" id="psave">Save</button><button class="btn link" id="pcancel">Cancel</button></div></div>`;
    $('#pcancel').onclick = () => { box.innerHTML = ''; };
    $('#psave').onclick = async () => {
      try {
        const body = na ? { mode: 'na', naReason: $('#pna').value } : { mode: 'upload', file: await fileToBody($('#pfile')), summary: $('#psum').value, replaceReason: $('#prep').value };
        await api('POST', `/api/documents/${d.id}/periods/${period}`, body);
        toast(`${period} saved.`); renderDoc();
      } catch (e) { $('#pflash').innerHTML = errs(e.fields) || `<div class="errbox">${esc(e.message)}</div>`; }
    };
  }
  async function openNew() {
    S.projects = (await api('GET', '/api/projects')).filter(p => p.status === 'active');
    const f = S.draft.new || { project: (S.projects.find(p => p.stream_started) || S.projects[0] || {}).code, type: 'PID', cls: 'controlled', owner: S.me };
    S.draft.new = f;
    const t = S.types.find(x => x.code === f.type) || S.types[0];
    const ov = $('#overlay'); ov.hidden = false;
    ov.innerHTML = `<div class="scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="New document">
      <h3>New document</h3>
      <div id="nflash">${errs(S.errors.nw)}</div>
      <div class="two"><div class="field"><label>Project</label><select class="t" id="np">${S.projects.map(p => `<option value="${p.code}" ${p.code === f.project ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Type</label><select class="t" id="nt">${S.types.map(x => `<option value="${x.code}" ${x.code === t.code ? 'selected' : ''}>${x.code} · ${esc(x.label)}</option>`).join('')}</select></div></div>
      <div class="note"><b>${CLS[t.cls]}.</b> ${t.cls === 'controlled' ? 'Upload, check and approve. Revisions.' : t.cls === 'periodic' ? 'Set up a monthly series. Each month is uploaded. No approval.' : 'Upload with an expiry date. Renew before expiry.'}<br>Folder: ${esc(t.folder.split('/').join(' › '))}</div>
      <div class="field"><label>Document number</label><div class="help">Assigned automatically from the project's numbering when you save.</div></div>
      <div class="field"><label>Title</label><input class="t" id="ntitle" value="${esc(f.title || '')}"></div>
      ${t.cls === 'periodic' ? `<div class="two"><div class="field"><label>Owner</label><select class="t" id="nown">${personOpts(f.owner)}</select></div>
        <div class="field"><label>Due day each month (1–28)</label><input type="number" min="1" max="28" class="t" id="ndue" value="${esc(f.dueDay || 5)}"></div></div>
        <div class="field"><label>First month</label><input type="month" class="t" id="nstart" value="${esc(f.start || today().slice(0, 7))}"></div>`
      : `<div class="field"><label>Owner</label><select class="t" id="nown">${personOpts(f.owner)}</select></div>
        <div class="field"><label>File</label><input type="file" id="nfile"></div>
        <div class="field"><label>One-line summary</label><input class="t" id="nsum" value="${esc(f.summary || '')}"></div>
        ${t.cls === 'record' ? `<div class="field"><label>Expiry date</label><input type="date" class="t" id="nexp" value="${esc(f.expiresOn || '')}"></div>` : `
        <div class="two"><div class="field"><label>Reason</label><select class="t" id="nreason">${REASONS.map(r => `<option ${f.reason === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div class="field"><label>Checker</label><select class="t" id="nchk">${personOpts(f.checker)}</select></div></div>
        <div class="field"><label>Approver</label><select class="t" id="napp">${personOpts(f.approver)}</select></div>
        <div class="field"><label>Note for the checker</label><textarea class="t" id="nnote">${esc(f.note || '')}</textarea></div>`}`}
      <div class="row" style="justify-content:flex-end"><button class="btn link" id="ncancel">Cancel</button><button class="btn primary" id="nsave">${t.cls === 'periodic' ? 'Set up series' : 'Save'}</button></div>
    </div></div>`;
    $('#np').onchange = e => { f.project = e.target.value; openNew(); };
    $('#nt').onchange = e => { f.type = e.target.value; openNew(); };
    $('#ncancel').onclick = closeOverlay;
    $('#nsave').onclick = async () => {
      try {
        const body = { project: $('#np').value, type: $('#nt').value, title: $('#ntitle').value, owner: $('#nown').value };
        if (t.cls === 'periodic') Object.assign(body, { dueDay: $('#ndue').value, start: $('#nstart').value });
        else {
          body.file = await fileToBody($('#nfile')); body.summary = $('#nsum').value;
          if (t.cls === 'record') body.expiresOn = $('#nexp').value;
          else Object.assign(body, { reason: $('#nreason').value, checker: $('#nchk').value, approver: $('#napp').value, note: $('#nnote').value });
        }
        const r = await api('POST', '/api/documents', body);
        closeOverlay(); toast('Saved.'); S.view = 'doc'; S.open = r.id; render();
      } catch (e) { S.errors.nw = e.fields ? Object.values(e.fields) : [e.message]; $('#nflash').innerHTML = errs(e.fields) || `<div class="errbox">${esc(e.message)}</div>`; }
    };
  }
  function closeOverlay() { const ov = $('#overlay'); ov.hidden = true; ov.innerHTML = ''; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

  async function renderAudit() {
    const rows = await api('GET', '/api/audit');
    $('#main').innerHTML = `<h1>Activity</h1><p class="sub">Every action, newest first. The log cannot be edited or deleted.</p>
      <div class="card log">${rows.map(r => `<div><span class="muted">${esc(r.at.replace('T', ' ').slice(0, 16))} · ${esc(r.who)}</span><span><b>${esc(r.action)}</b> ${esc(r.number || '')} ${esc(r.detail)}</span></div>`).join('') || 'Nothing yet.'}</div>`;
  }


  /* ---------- Projects: setup, folders, document types ---------- */
  const isAdmin = () => (S.users.find(u => u.name === S.me) || {}).role === 'admin';
  async function renderProjects() {
    const list = await api('GET', '/api/projects');
    $('#main').innerHTML = `<h1>Projects</h1>
      <p class="sub">Each project has its own code, folder structure and document types. ${isAdmin() ? '' : 'Only the records lead can add or change a project.'}</p>
      <div class="row" style="margin-bottom:10px"><span class="grow"></span>${isAdmin() ? '<button class="btn primary" id="addproj">+ Add project</button>' : ''}</div>
      <div class="tw"><table><thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Documents</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr><td class="no"><b>${esc(p.code)}</b></td><td>${esc(p.name)}</td>
        <td><span class="pill ${p.status === 'active' ? 'p-ok' : 'p-old'}">${p.status === 'active' ? 'Active' : 'Archived'}</span></td>
        <td>${p.documents}</td><td><button class="btn" data-editproj="${esc(p.code)}">${isAdmin() ? 'Open setup' : 'View setup'}</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted" style="padding:20px">No projects yet.</td></tr>'}
      </tbody></table></div>`;
    const add = $('#addproj');
    if (add) add.onclick = () => openProjectForm(null);
    document.querySelectorAll('[data-editproj]').forEach(b => b.onclick = () => openProjectForm(b.dataset.editproj));
  }
  function numExample(pattern) {
    const sample = { PROJ: 'U100', TYPE: 'PID', YYYY: String(new Date().getUTCFullYear()) };
    if (!/\{SEQ(?::\d)?\}/.test(pattern || '')) return 'needs one {SEQ} token';
    return (pattern || '').replace(/\{(PROJ|TYPE|YYYY)\}/g, (_, k) => sample[k]).replace(/\{SEQ(?::(\d))?\}/, (_, w) => '457'.padStart(Number(w || 4), '0'));
  }
  async function openProjectForm(code) {
    S.templates = await api('GET', '/api/templates').catch(() => []);
    S.allTypes = await api('GET', '/api/template').then(t => t.types).catch(() => []);
    let pf;
    if (!code) {
      const tpl = await api('GET', '/api/template');
      pf = { mode: 'new', code: '', name: '', status: 'active', numberPattern: '{PROJ}-{TYPE}-{SEQ:4}', folders: tpl.folders.slice(),
        types: tpl.types.map(t => ({ code: t.code, label: t.label, cls: t.cls, enabled: true, folder: t.folder, firstNumber: 1, documents: 0 })) };
    } else {
      const p = await api('GET', '/api/projects/' + encodeURIComponent(code));
      pf = { mode: 'edit', code: p.code, name: p.name, status: p.status, locked: p.locked, numberPattern: p.numberPattern,
        folders: p.folders.map(f => f.path), folderDocs: Object.fromEntries(p.folders.map(f => [f.path, f.documents])),
        types: p.types.map(t => ({ ...t })) };
      pf.typeDocs = Object.fromEntries(p.types.map(t => [t.code, t.documents]));
    }
    S.pf = pf; S.pfErr = {}; S.pfNewFolder = ''; S.pfTpl = ''; S.pfTplName = '';
    drawProjectForm();
  }
  function drawProjectForm() {
    const pf = S.pf, admin = isAdmin(), ro = !admin;
    const ov = $('#overlay'); ov.hidden = false;
    const enabled = pf.types.filter(t => t.enabled);
    const errList = Object.values(S.pfErr);
    ov.innerHTML = `<div class="scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="Project setup" style="width:min(820px,100%)">
      <h3>${pf.mode === 'new' ? 'Add a project' : esc(pf.code) + ' · project setup'}</h3>
      <p class="sub" style="margin-bottom:12px">Work through the three parts. Then press Save.${pf.locked ? ' <b>Documents exist.</b> The code and folders with documents are locked.' : ''}</p>
      ${errList.length ? `<div class="errbox">${errList.map(esc).join('<br>')}</div>` : ''}
      <h2 style="margin-top:0">1. Basics</h2>
      <div class="two">
        <div class="field"><label for="pcode">Project code</label><input class="t" id="pcode" value="${esc(pf.code)}" ${pf.mode === 'edit' || ro ? 'disabled' : ''} placeholder="e.g. U100">
          <div class="help">2 to 5 capital letters or digits. Used at the start of every document number. Cannot change later.</div></div>
        <div class="field"><label for="pname">Project name</label><input class="t" id="pname" value="${esc(pf.name)}" ${ro ? 'disabled' : ''}></div>
      </div>
      ${pf.mode === 'edit' ? `<div class="field"><label for="pstat">Status</label><select class="t" id="pstat" ${ro ? 'disabled' : ''} style="max-width:240px"><option value="active" ${pf.status === 'active' ? 'selected' : ''}>Active</option><option value="archived" ${pf.status === 'archived' ? 'selected' : ''}>Archived (no new documents)</option></select></div>` : ''}

      ${pf.mode === 'new' ? `<h2 style="margin-top:0">0. Start from a template</h2>
      <div class="row" style="margin-bottom:6px"><select class="t" id="tplsel" style="max-width:360px"><option value="">Blank: start from the standard structure</option>${(S.templates || []).map(t => `<option value="${esc(t.id)}" ${S.pfTpl === t.id ? 'selected' : ''}>${esc(t.name)}${t.builtIn ? '' : ' (saved)'}</option>`).join('')}</select>
        <button class="btn" id="tplload" ${ro ? 'disabled' : ''}>Load template</button></div>
      <div class="help">Loading fills in the folders, numbering and document types below. You can still change them.</div>` : ''}
      <h2>1b. Numbering</h2>
      <div class="field"><label for="numpat">Numbering pattern</label>
        <input class="t" id="numpat" value="${esc(pf.numberPattern)}" ${ro || pf.locked ? 'disabled' : ''} style="max-width:360px;font-family:ui-monospace,Consolas,monospace">
        <div class="help">Tokens: <b>{PROJ}</b> project code · <b>{TYPE}</b> document type · <b>{SEQ:4}</b> running number, 4 digits (required, once) · <b>{YYYY}</b> year. Other characters: letters, digits, - . _ /</div>
        <div class="help">Example: <b id="numex">${esc(numExample(pf.numberPattern))}</b>${pf.locked ? ' · <b>locked: documents exist</b>' : ''}</div></div>

      <h2>2. Folders</h2>
      <div class="row" style="margin-bottom:8px">${ro ? '' : `<label class="small">Or upload a CSV: <input type="file" id="csvfile" accept=".csv,text/csv"></label>`}<span class="help">Columns: folder, types (optional, separated by ;). See the template in the help.</span></div>
      ${S.pfCsvMsg ? `<div class="${S.pfCsvErr ? 'errbox' : 'note'}">${S.pfCsvMsg}</div>` : ''}
      <p class="help" style="margin:0 0 8px">Every document is filed in one folder. Start from the standard structure, then add or remove. A folder that holds documents cannot be removed.</p>
      <div class="tw" style="max-height:260px;overflow:auto"><table style="min-width:0"><tbody>
        ${pf.folders.map(f => {
          const n = pf.folderDocs ? pf.folderDocs[f] || 0 : 0;
          return `<tr><td class="small">${esc(f.split('/').join(' › '))}</td><td style="width:120px" class="small muted">${n ? n + ' doc(s)' : ''}</td>
            <td style="width:90px"><button class="btn link" data-rmfolder="${esc(f)}" ${ro || n ? 'disabled' : ''}>Remove</button></td></tr>`;
        }).join('') || '<tr><td class="muted">No folders yet.</td></tr>'}
      </tbody></table></div>
      <div class="row" style="margin-top:8px"><input class="t" id="newfolder" placeholder="New folder, e.g. EPC/07 Close-out/07.1 Records" value="${esc(S.pfNewFolder)}" style="flex:1" ${ro ? 'disabled' : ''}>
        <button class="btn" id="addfolder" ${ro ? 'disabled' : ''}>Add folder</button>
        ${pf.mode === 'new' ? '<button class="btn link" id="resetfolders">Reset to standard</button>' : ''}</div>
      <div class="help">Up to 4 levels, separated by /. Letters, digits, spaces, . - & ( ).</div>

      <h2>3. Document types</h2>
      <p class="help" style="margin:0 0 8px">Turn on the types this project uses. Each one files into one folder. Numbering starts at the first number (set it to continue an existing register).</p>
      <div class="tw" style="max-height:300px;overflow:auto"><table style="min-width:0"><thead><tr><th></th><th>Type</th><th>Kind</th><th>Files into</th><th>First number</th></tr></thead><tbody>
        ${pf.types.map((t, i) => {
          const locked = pf.mode === 'edit' && (pf.typeDocs ? pf.typeDocs[t.code] : 0) > 0;
          return `<tr><td><input type="checkbox" data-tenable="${i}" ${t.enabled ? 'checked' : ''} ${ro || (locked && t.enabled) ? 'disabled' : ''}></td>
            <td><span class="no">${esc(t.code)}</span> ${esc(t.label)}${locked ? ' <span class="small muted">· in use</span>' : ''}</td>
            <td class="small">${esc(t.cls)}</td>
            <td><select class="t" data-tfolder="${i}" ${ro || !t.enabled ? 'disabled' : ''} style="min-width:200px">${pf.folders.map(f => `<option ${f === t.folder ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></td>
            <td><input class="t" type="number" min="1" max="9999" data-tfirst="${i}" value="${esc(t.firstNumber)}" style="width:90px" ${ro || locked ? 'disabled' : ''}></td></tr>`;
        }).join('')}
      </tbody></table></div>
      ${pf.mode === 'edit' && !ro ? `<div class="row" style="margin-top:12px"><span class="small muted">Save this setup as a template:</span><input class="t" id="tplname" placeholder="Template name" style="max-width:240px"><button class="btn" id="tplsave">Save as template</button></div>` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:14px"><span class="small muted grow">${enabled.length} document types on · ${pf.folders.length} folders</span>
        <button class="btn link" id="pcancel">Cancel</button>${ro ? '' : `<button class="btn primary" id="psave">${pf.mode === 'new' ? 'Create project' : 'Save changes'}</button>`}</div>
    </div></div>`;
    bindProjectForm();
  }
  function bindProjectForm() {
    const pf = S.pf;
    $('#pcancel').onclick = closeOverlay;
    const name = $('#pname'), code = $('#pcode');
    if (name) name.oninput = e => { pf.name = e.target.value; };
    if (code) code.oninput = e => { pf.code = e.target.value.toUpperCase(); };
    const st = $('#pstat'); if (st) st.onchange = e => { pf.status = e.target.value; };
    const np = $('#numpat'); if (np) np.oninput = e => { pf.numberPattern = e.target.value; const ex = $('#numex'); if (ex) ex.textContent = numExample(pf.numberPattern); };
    const tl = $('#tplload');
    if (tl) tl.onclick = async () => {
      const id = $('#tplsel').value;
      S.pfTpl = id;
      if (!id) { const tpl = await api('GET', '/api/template'); pf.folders = tpl.folders.slice(); pf.types = tpl.types.map(t => ({ code: t.code, label: t.label, cls: t.cls, enabled: true, folder: t.folder, firstNumber: 1, documents: 0 })); pf.numberPattern = '{PROJ}-{TYPE}-{SEQ:4}'; }
      else {
        const tpl = await api('GET', '/api/templates/' + encodeURIComponent(id));
        const std = await api('GET', '/api/template');
        pf.folders = tpl.folders.slice();
        pf.numberPattern = tpl.numberPattern;
        pf.types = std.types.map(t => { const use = tpl.types.find(x => x.code === t.code); return { code: t.code, label: t.label, cls: t.cls, enabled: !!use, folder: use ? use.folder : t.folder, firstNumber: use ? use.firstNumber : 1, documents: 0 }; });
      }
      S.pfErr = {}; drawProjectForm();
    };
    const cf = $('#csvfile');
    if (cf) cf.onchange = async () => {
      const f = cf.files[0]; if (!f) return;
      const text = await f.text();
      const r = await api('POST', '/api/folders/preview', { text });
      if (r.errors.length) { S.pfCsvErr = true; S.pfCsvMsg = 'The file has problems. Nothing was changed:<br>' + r.errors.map(e => `Line ${e.line}: ${esc(e.message)}`).join('<br>'); return drawProjectForm(); }
      S.pfCsvErr = false;
      S.pfCsvMsg = `Loaded ${r.folders.length} folders and ${r.types.length} document types from the file${r.usedDefaults ? ' (types matched to folders by standard filing)' : ''}.`;
      pf.folders = r.folders.slice();
      pf.types = (S.allTypes || []).map(t => { const use = r.types.find(x => x.code === t.code); return { code: t.code, label: t.label, cls: t.cls, enabled: !!use, folder: use ? use.folder : (pf.folders.includes(t.folder) ? t.folder : (pf.folders[0] || '')), firstNumber: 1, documents: 0 }; });
      drawProjectForm();
    };
    const ts = $('#tplsave');
    if (ts) ts.onclick = async () => {
      const name = $('#tplname').value.trim();
      try { await api('POST', '/api/templates', { name, code: pf.code, description: 'Saved from ' + pf.code }); toast('Template saved.'); S.templates = await api('GET', '/api/templates'); }
      catch (e) { S.pfErr = { template: e.message }; drawProjectForm(); }
    };
    const nf = $('#newfolder'); if (nf) nf.oninput = e => { S.pfNewFolder = e.target.value; };
    const add = $('#addfolder');
    if (add) add.onclick = () => {
      const f = (S.pfNewFolder || '').trim();
      if (!f) return;
      if (pf.folders.includes(f)) { S.pfErr = { dup: 'That folder already exists.' }; return drawProjectForm(); }
      pf.folders.push(f); S.pfNewFolder = ''; S.pfErr = {}; drawProjectForm();
    };
    const reset = $('#resetfolders');
    if (reset) reset.onclick = async () => {
      const tpl = await api('GET', '/api/template');
      pf.folders = tpl.folders.slice();
      pf.types = pf.types.map(t => { const std = tpl.types.find(x => x.code === t.code); return { ...t, folder: std ? std.folder : t.folder }; });
      drawProjectForm();
    };
    document.querySelectorAll('[data-rmfolder]').forEach(b => b.onclick = () => {
      const f = b.dataset.rmfolder;
      pf.folders = pf.folders.filter(x => x !== f);
      pf.types.forEach(t => { if (t.folder === f) t.folder = pf.folders[0] || ''; });
      drawProjectForm();
    });
    document.querySelectorAll('[data-tenable]').forEach(c => c.onchange = () => { pf.types[+c.dataset.tenable].enabled = c.checked; drawProjectForm(); });
    document.querySelectorAll('[data-tfolder]').forEach(s => s.onchange = () => { pf.types[+s.dataset.tfolder].folder = s.value; });
    document.querySelectorAll('[data-tfirst]').forEach(s => s.oninput = () => { pf.types[+s.dataset.tfirst].firstNumber = Number(s.value); });
    const save = $('#psave');
    if (save) save.onclick = async () => {
      if (name) pf.name = name.value;
      if (code) pf.code = code.value.toUpperCase();
      if (np) pf.numberPattern = np.value;
      const body = { code: pf.code, name: pf.name, status: pf.status, folders: pf.folders, numberPattern: pf.numberPattern,
        types: pf.types.map(t => ({ code: t.code, enabled: t.enabled, folder: t.folder, firstNumber: t.firstNumber })) };
      try {
        if (pf.mode === 'new') await api('POST', '/api/projects', body);
        else await api('PUT', '/api/projects/' + encodeURIComponent(pf.code), body);
        closeOverlay(); toast(pf.mode === 'new' ? `${pf.code} created.` : 'Saved.');
        S.tab = 'projects'; render();
      } catch (e) {
        S.pfErr = e.fields ? Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, v])) : { error: e.message };
        drawProjectForm();
      }
    };
  }

  boot();
})();
