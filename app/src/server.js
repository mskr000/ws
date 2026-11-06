'use strict';
/* HTTP server. No frameworks. Binds to 127.0.0.1 by default so only this computer can reach it. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { AppError } = require('./service');

const PUBLIC = path.join(__dirname, '..', 'public');
const MAX_BODY = 80 * 1024 * 1024; // room for a 50 MB file once base64 encoded

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new AppError(413, 'Upload is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
/* Files come in as base64 inside JSON. Decoded here, never trusted as a path. */
function decodeFile(f) {
  if (!f) return null;
  if (typeof f.name !== 'string' || typeof f.base64 !== 'string') throw new AppError(400, 'File is not valid.');
  return { name: f.name, buffer: Buffer.from(f.base64, 'base64') };
}

function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'", ...extra });
  res.end(payload);
}

function createServer({ service, devAuth = true }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;
      /* Static page */
      if (req.method === 'GET' && (p === '/' || p.startsWith('/static/'))) {
        const file = p === '/' ? 'index.html' : p.slice('/static/'.length);
        const full = path.normalize(path.join(PUBLIC, file));
        if (!full.startsWith(PUBLIC) || !fs.existsSync(full)) return send(res, 404, { error: 'Not found.' });
        return send(res, 200, fs.readFileSync(full), TYPES[path.extname(full)] || 'application/octet-stream');
      }
      if (!p.startsWith('/api/')) return send(res, 404, { error: 'Not found.' });

      /* Names only, so the sign-in list can load before anyone is signed in. */
      if (req.method === 'GET' && p === '/api/signin') return send(res, 200, service.listUsers().map(u => u.name));

      /* Identity. Development only: the name is taken from a header. Replace with company sign-in before real use. */
      const actor = req.headers['x-actor'];
      if (!devAuth) return send(res, 503, { error: 'Sign-in is not configured.' });
      if (!actor) return send(res, 401, { error: 'Sign in first.' });
      let role;
      try { role = service.actorRole(String(actor)); } catch { return send(res, 403, { error: 'Unknown user.' }); }
      const who = String(actor);

      const parts = p.split('/').filter(Boolean); // ['api', ...]
      const body = ['POST', 'PUT'].includes(req.method) ? JSON.parse((await readBody(req)).toString('utf8') || '{}') : {};

      if (req.method === 'GET' && p === '/api/me') return send(res, 200, { name: who, role });
      if (req.method === 'GET' && p === '/api/projects') return send(res, 200, service.listProjects());
      if (req.method === 'GET' && p === '/api/template') return send(res, 200, service.standardTemplate());
      if (req.method === 'POST' && p === '/api/projects') return send(res, 201, { code: service.createProject(who, body) });
      if (parts.length === 3 && parts[1] === 'projects') {
        const code = decodeURIComponent(parts[2]);
        if (req.method === 'GET') return send(res, 200, service.getProject(code));
        if (req.method === 'PUT') return send(res, 200, { changes: service.updateProject(who, code, body) });
      }
      if (req.method === 'GET' && p === '/api/types') return send(res, 200, service.listTypes());
      if (req.method === 'GET' && p === '/api/users') return send(res, 200, service.listUsers());
      if (req.method === 'GET' && p === '/api/documents') {
        return send(res, 200, service.listDocuments({ project: url.searchParams.get('project'), cls: url.searchParams.get('cls'),
          q: url.searchParams.get('q'), removed: url.searchParams.get('removed') === '1' }));
      }
      if (req.method === 'POST' && p === '/api/documents') {
        const id = service.createDocument(who, { ...body, file: decodeFile(body.file) });
        return send(res, 201, { id });
      }
      if (req.method === 'GET' && parts.length === 3 && parts[1] === 'documents') {
        return send(res, 200, service.getDocument(Number(parts[2])));
      }
      if (req.method === 'POST' && parts.length === 4 && parts[1] === 'documents' && parts[3] === 'revisions') {
        const n = service.submitRevision(who, Number(parts[2]), { ...body, file: decodeFile(body.file) });
        return send(res, 201, { n });
      }
      if (req.method === 'POST' && parts.length === 4 && parts[1] === 'revisions') {
        const id = Number(parts[2]);
        if (parts[3] === 'check') return send(res, 200, { n: service.checkRevision(who, id) });
        if (parts[3] === 'approve') return send(res, 200, { n: service.approveRevision(who, id) });
        if (parts[3] === 'return') return send(res, 200, { n: service.returnRevision(who, id, body.text) });
      }
      if (req.method === 'POST' && parts.length === 5 && parts[1] === 'documents' && parts[3] === 'periods') {
        const key = decodeURIComponent(parts[4]);
        return send(res, 200, { period: service.uploadPeriod(who, Number(parts[2]), key, { ...body, file: decodeFile(body.file) }) });
      }
      if (req.method === 'POST' && parts.length === 4 && parts[1] === 'documents' && parts[3] === 'renew') {
        return send(res, 201, { n: service.renewCertificate(who, Number(parts[2]), { ...body, file: decodeFile(body.file) }) });
      }
      if (req.method === 'POST' && parts.length === 4 && parts[1] === 'documents' && parts[3] === 'remove') {
        return send(res, 200, { name: service.removeDocument(who, Number(parts[2]), body) });
      }
      if (req.method === 'POST' && parts.length === 4 && parts[1] === 'documents' && parts[3] === 'restore') {
        return send(res, 200, { ok: service.restoreDocument(who, Number(parts[2])) });
      }
      if (req.method === 'GET' && p === '/api/audit') {
        const doc = url.searchParams.get('document');
        return send(res, 200, service.listAudit({ documentId: doc ? Number(doc) : undefined }));
      }
      if (req.method === 'GET' && parts.length === 3 && parts[1] === 'files') {
        const fp = service.fileForSha(parts[2]);
        const name = url.searchParams.get('name') || parts[2] + '.bin';
        return send(res, 200, fs.readFileSync(fp), 'application/octet-stream',
          { 'Content-Disposition': `attachment; filename="${name.replace(/[^\w.\- ]/g, '_')}"` });
      }
      return send(res, 404, { error: 'Not found.' });
    } catch (err) {
      if (err instanceof AppError) return send(res, err.status, { error: err.message, fields: err.fields });
      if (err instanceof SyntaxError) return send(res, 400, { error: 'Request is not valid JSON.' });
      console.error(err);
      return send(res, 500, { error: 'Something went wrong. The details are in the server log.' });
    }
  });
}

module.exports = { createServer };
