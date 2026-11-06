import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/domain/contacts.ts';

const list: K.Contact[] = [
  { id: 1, company: 'Client A', name: 'Ana Reyes', email: 'ana@clienta.com', removed: false },
  { id: 2, company: 'Client A', name: 'Ben Okafor', email: 'ben@clienta.com', removed: false },
  { id: 3, company: 'Contractor B', name: 'Chen Wei', email: 'chen@contractorb.com', removed: false },
  { id: 4, company: 'Old Co', name: 'Gone Person', email: 'gone@old.com', removed: true },
];

test('companies and their people, removed people hidden', () => {
  assert.deepEqual(K.companiesOf(list), ['Client A', 'Contractor B']);
  assert.deepEqual(K.peopleOf(list, 'Client A').map(p => p.name), ['Ana Reyes', 'Ben Okafor']);
});

test('a new person needs a company, a name and a full, unused address', () => {
  assert.equal(Object.keys(K.contactErrors({ company: 'Client A', name: 'Dee', email: 'dee@clienta.com' }, list)).length, 0);
  assert.ok(K.contactErrors({ company: '', name: 'Dee', email: 'dee@clienta.com' }, list).company);
  assert.ok(K.contactErrors({ company: 'Client A', name: 'Dee', email: 'bad' }, list).email);
  assert.ok(K.contactErrors({ company: 'Client A', name: 'Dee', email: 'ANA@clienta.com' }, list).email);
});

test('selected people become recipients: one address each, company order, no repeats', () => {
  const r = K.recipientsOf(list, [3, 2, 1, 1, 4]);
  assert.deepEqual(r.emails, ['ana@clienta.com', 'ben@clienta.com', 'chen@contractorb.com']);
  assert.deepEqual(r.companies, ['Client A', 'Contractor B']);
  const dup = [{ id: 9, company: 'Client A', name: 'Ana again', email: 'ANA@clienta.com', removed: false }];
  assert.equal(K.recipientsOf(list.concat(dup), [1, 9]).people.length, 1);
});
