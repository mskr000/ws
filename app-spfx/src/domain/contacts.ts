/* Recipients: companies and the people in them. Pure. Nothing is deleted; a person is marked removed. */
// @ts-ignore .ts extension so Node's test runner can load it (see dashboard.ts).
import { validEmail } from './mail.ts';

export interface Contact { id: number; company: string; name: string; email: string; removed: boolean }

export function companiesOf(cs: Contact[]): string[] {
  return Array.from(new Set(cs.filter(c => !c.removed).map(c => c.company))).sort((a, b) => a.localeCompare(b));
}

export function peopleOf(cs: Contact[], company: string): Contact[] {
  return cs.filter(c => !c.removed && c.company === company).sort((a, b) => a.name.localeCompare(b.name));
}

export function contactErrors(c: { company: string; name: string; email: string }, existing: Contact[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (!c.company.trim()) e.company = 'Name the company.';
  if (!c.name.trim()) e.name = 'Give the person\'s name.';
  if (!validEmail(c.email)) e.email = 'Enter a full address, e.g. name@company.com.';
  else if (existing.some(x => !x.removed && x.email.toLowerCase() === c.email.trim().toLowerCase())) e.email = 'That address is already in the list.';
  return e;
}

/* The people selected for a send. One address per person, no repeats, in company order. */
export function recipientsOf(cs: Contact[], ids: number[]): { companies: string[]; people: Contact[]; emails: string[] } {
  const picked = cs.filter(c => !c.removed && ids.includes(c.id))
    .sort((a, b) => a.company.localeCompare(b.company) || a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const people = picked.filter(p => { const k = p.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return { companies: Array.from(new Set(people.map(p => p.company))), people, emails: people.map(p => p.email.trim()) };
}
