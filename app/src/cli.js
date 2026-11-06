#!/usr/bin/env node
'use strict';
/* Entry point.
   node src/cli.js seed    create a new database with demo content (empty database only)
   node src/cli.js         start the app at http://127.0.0.1:8787 */
const path = require('node:path');
const { openDb } = require('./db');
const { createService } = require('./service');
const { createServer } = require('./server');
const { loadReference, seedDemo } = require('./seed');

const dataDir = process.env.DMS_DATA || path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'register.db');
const filesDir = path.join(dataDir, 'files');
const host = process.env.DMS_HOST || '127.0.0.1';
const port = Number(process.env.DMS_PORT || 8787);

const db = openDb(dbFile);
const cmd = process.argv[2] || 'start';

if (cmd === 'seed') {
  seedDemo(db, filesDir);
  console.log(`Demo data written to ${dbFile}`);
  process.exit(0);
}
loadReference(db); // reference lists are safe to re-check on every start
const service = createService({ db, filesDir });
const server = createServer({ service, devAuth: process.env.DMS_AUTH !== 'off' });
server.listen(port, host, () => {
  console.log(`Document register running at http://${host}:${port}`);
  console.log(`Data folder: ${dataDir}`);
  console.log('DEVELOPMENT SIGN-IN: the name in the page is trusted. Keep this on your own computer.');
});
