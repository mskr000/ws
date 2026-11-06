'use strict';
/* Database setup. SQLite file on the local machine. Audit log is enforced append-only by the database itself. */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  name TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('member','admin'))
);
CREATE TABLE IF NOT EXISTS projects (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stream_started INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS project_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_folders (
  project TEXT NOT NULL REFERENCES projects(code),
  path TEXT NOT NULL,
  PRIMARY KEY (project, path)
);
CREATE TABLE IF NOT EXISTS project_types (
  project TEXT NOT NULL REFERENCES projects(code),
  type TEXT NOT NULL REFERENCES types(code),
  folder TEXT NOT NULL,
  first_number INTEGER NOT NULL DEFAULT 1 CHECK (first_number >= 1),
  PRIMARY KEY (project, type)
);
CREATE TABLE IF NOT EXISTS types (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  cls TEXT NOT NULL CHECK (cls IN ('controlled','periodic','record')),
  folder TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL REFERENCES projects(code),
  type TEXT NOT NULL,
  cls TEXT NOT NULL CHECK (cls IN ('controlled','periodic','record')),
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  folder TEXT NOT NULL,
  owner TEXT NOT NULL,
  due_day INTEGER,
  start_period TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  sp_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  n INTEGER NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  summary TEXT,
  note TEXT,
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  by TEXT NOT NULL,
  checker TEXT,
  approver TEXT,
  checked_by TEXT,
  approved_by TEXT,
  return_note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (document_id, n)
);
CREATE TABLE IF NOT EXISTS periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  period TEXT NOT NULL,
  version INTEGER NOT NULL,
  na INTEGER NOT NULL DEFAULT 0,
  na_reason TEXT,
  summary TEXT,
  file_name TEXT,
  file_sha256 TEXT,
  file_size INTEGER,
  replace_reason TEXT,
  by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  UNIQUE (document_id, period, version)
);
CREATE TABLE IF NOT EXISTS certificate_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  n INTEGER NOT NULL,
  summary TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  expires_on TEXT NOT NULL,
  by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  UNIQUE (document_id, n)
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  who TEXT NOT NULL,
  action TEXT NOT NULL,
  document_id INTEGER,
  detail TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
`;

/* Data format version. Stored in the database itself (PRAGMA user_version).
   Bump DATA_VERSION and add a step to MIGRATIONS when the stored data changes shape. */
const DATA_VERSION = 2;

const MIGRATIONS = {
  // 0 -> 1: projects gained status, created_at, created_by (earliest local databases).
  1: db => {
    const cols = db.prepare('PRAGMA table_info(projects)').all().map(c => c.name);
    if (!cols.includes('status')) db.exec("ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    if (!cols.includes('created_at')) db.exec("ALTER TABLE projects ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
    if (!cols.includes('created_by')) db.exec("ALTER TABLE projects ADD COLUMN created_by TEXT NOT NULL DEFAULT ''");
  },
  // 1 -> 2: projects gained a numbering pattern.
  2: db => {
    const cols = db.prepare('PRAGMA table_info(projects)').all().map(c => c.name);
    if (!cols.includes('number_pattern')) db.exec("ALTER TABLE projects ADD COLUMN number_pattern TEXT NOT NULL DEFAULT '{PROJ}-{TYPE}-{SEQ:4}'");
  },
};

function userVersion(db) { return db.prepare('PRAGMA user_version').get().user_version; }

function hasData(db) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'projects'").get();
}

/* Opens the database and brings it to DATA_VERSION. Before any upgrade of existing data,
   a full copy is written to the backups folder. Refuses data written by a newer version. */
function openDb(file, { backupDir } = {}) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const from = userVersion(db);
  if (from > DATA_VERSION) {
    db.close();
    throw new Error(`This data was written by a newer version (format ${from}). This app reads format ${DATA_VERSION}. Install the newer version instead.`);
  }
  const existing = hasData(db);
  if (existing && from < DATA_VERSION) backupTo(db, backupDir || path.join(path.dirname(file), 'backups'), from);
  db.exec(SCHEMA);
  for (let v = from + 1; v <= DATA_VERSION; v++) {
    tx(db, () => { MIGRATIONS[v](db); db.exec(`PRAGMA user_version = ${v}`); });
  }
  return db;
}

/* A consistent copy of the whole database, safe while the app is running (VACUUM INTO). */
function backupTo(db, dir, fromVersion = userVersion(db)) {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(dir, `register-format${fromVersion}-${stamp}.db`);
  db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
  return out;
}

/* Run fn inside a transaction. Rolls back on any error. */
function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { openDb, tx, backupTo, DATA_VERSION };
