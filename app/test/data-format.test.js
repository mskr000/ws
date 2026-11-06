'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { openDb, DATA_VERSION } = require('../src/db');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dms-fmt-'));
const version = db => db.prepare('PRAGMA user_version').get().user_version;

test('a new database is written at the current format', () => {
  const dir = tmp();
  const db = openDb(path.join(dir, 'register.db'));
  assert.equal(version(db), DATA_VERSION);
  assert.equal(fs.existsSync(path.join(dir, 'backups')), false, 'no backup for a new database');
  db.close();
});

test('an old database is backed up before it is upgraded', () => {
  const dir = tmp();
  const file = path.join(dir, 'register.db');
  const old = new DatabaseSync(file);
  old.exec("CREATE TABLE projects (code TEXT PRIMARY KEY, name TEXT NOT NULL); INSERT INTO projects VALUES ('U100', 'Unit 100');");
  old.close();
  const db = openDb(file);
  assert.equal(version(db), DATA_VERSION);
  assert.equal(db.prepare("SELECT name FROM projects WHERE code = 'U100'").get().name, 'Unit 100', 'existing rows survive');
  const backups = fs.readdirSync(path.join(dir, 'backups'));
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^register-format0-/);
  const copy = new DatabaseSync(path.join(dir, 'backups', backups[0]));
  assert.equal(copy.prepare("SELECT name FROM projects WHERE code = 'U100'").get().name, 'Unit 100', 'backup holds the data');
  copy.close();
  db.close();
});

test('a database from a newer version is refused, not changed', () => {
  const dir = tmp();
  const file = path.join(dir, 'register.db');
  const future = new DatabaseSync(file);
  future.exec(`PRAGMA user_version = ${DATA_VERSION + 1}`);
  future.close();
  assert.throws(() => openDb(file), /newer version/);
  const again = new DatabaseSync(file);
  assert.equal(version(again), DATA_VERSION + 1);
  again.close();
});

test('opening a current database twice makes no backup and changes nothing', () => {
  const dir = tmp();
  const file = path.join(dir, 'register.db');
  openDb(file).close();
  openDb(file).close();
  assert.equal(fs.existsSync(path.join(dir, 'backups')), false);
});
