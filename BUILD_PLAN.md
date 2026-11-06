# Build plan: Document Register app

Date: 2026-11-06. Branch: `scope/dms-v1`.

## What exists now (Phase 1, done)

- Runs on one computer. Node 22 built-in SQLite. No install beyond Node.
- Three document kinds, enforced on the server: controlled, recurring, certificate.
- Numbering streams per project. Numbers never reused.
- Controlled workflow: upload, check, approve, send back. Three different people.
- Recurring: monthly periods, on time / late / missing / not needed, replacements kept.
- Certificates: expiry, renewal, expiring and expired states.
- Remove and restore: records lead only. Renamed, never erased.
- Downloads with checksums. Every file stored by its SHA-256.
- Audit log that the database itself refuses to edit or delete.
- Tests: 30 automated checks. Browser test of the real page: all steps pass.
- Project setup: code, folders, document types, first number. Records lead only. Changes logged.

## Still to build

| Phase | What | Depends on | Effort (my build time) | Calendar time |
|---|---|---|---|---|
| 2. Working copies | Start draft, download, upload draft, submit. Check-out lock. | Phase 1 | 1 session | 1 week with review |
| 3. Full page parity | Folders view, transmittals, dashboard, calendar, my-work list, master document list | Phase 1 | 1–2 sessions | 1–2 weeks |
| 4. Company sign-in | Windows (Kerberos) or Microsoft 365 (Entra ID) sign-in. Roles from company groups. | IT approval for app registration | 1 session to wire, 1 to test | 1–3 weeks, mostly approvals |
| 5. SharePoint storage | Files live in a SharePoint library. Rename-only delete. Certificate-based app access. | Tenant, library, app permission | 1–2 sessions | 2–3 weeks incl. approvals |
| 6. Hardening | Malware scan on upload, backup and restore test, penetration test, incident steps | Phases 4 and 5 | 1 session + external test | 2–3 weeks |
| 7. Pilot | One project, named users, daily checks | Phase 6 | — | 2–4 weeks |

Effort is build time for me, not calendar time. Calendar time is set by approvals and your review.

## Decisions needed (in order)

1. **Pilot first on your laptop?** Recommended: yes. No company documents until Phase 4.
2. **Identity:** Windows sign-in only (AD), or Microsoft 365 (Entra ID)? Check: does your SharePoint address end in `.sharepoint.com`?
3. **SharePoint:** Online or on-premises? Who at the company can approve an app registration?
4. **Who maintains the app after handover?** One named person, plus IT for the laptop or server.
5. **Retention and purge:** confirmed periods (drafts: 365 days, audit: 7 years proposed).

## How we work from here

- **One change at a time.** Each change has a branch, tests, and a short note in `CHANGELOG.md`.
- **Tests before merge.** `npm test` must pass. The browser check must pass for UI changes.
- **Scope before build.** Any new document kind or workflow change gets a short scope note first.
- **Security review at each phase.** Use `../SECURITY_SCOPE.md` as the checklist.
- **Updates on your laptop:** stop the app, back up `app/data`, pull the new version, run `npm test`, start the app.
- **Ownership:** the person named in decision 4 approves changes. I write them and explain them.

## Risks

- **Company sign-in takes longest.** Start the approval request now, in parallel with Phase 2.
- **Laptop as a server.** Fine for a pilot. Not for many users. Move to a managed server after the pilot.
- **Experimental SQLite in Node 22.** Node shows a warning. Check the Node release notes before each upgrade, and keep the version fixed for the pilot.
- **Browser-only checks are not enough.** Real pilot use will find things the tests miss. Plan a two-week pilot with feedback.
