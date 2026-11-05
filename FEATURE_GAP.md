# Document Management System: Audit and Feature Gap

Status date: 2026-11-05. Branch: `scope/dms-v1`.

## 1. What exists

| Item | State |
|---|---|
| Repo | `SCOPE.md` only. No application code, tests, CI or config. |
| Register demo (5 projects, 5,000 docs) | Browser-only prototype. State in memory. Refresh resets it. |
| Upload gate | Client-side checks only (demo). |
| Activity log | In-memory array. Demo only. |
| SharePoint | Not connected. Auth model not decided. |

## 2. Audit findings

### Critical

1. **Create bypasses the upload gate.** A new document is created with Rev 0 and no file, summary, comment or reviewer. Anyone can add documents that the gate would block as revisions.
2. **Gate is client-side only.** Any API caller can skip it. The server must enforce the same rules.
3. **Upload does not store the file.** Demo keeps only name and size. No storage, no hash, no virus scan.
4. **Audit log is mutable in the prototype.** Any script can rewrite the array. Production needs an append-only store.
5. **No authentication or roles.** Anyone can edit, delete and restore. No permission model exists.

### High

6. **Summary and comment checks are length-only.** "aaaaaaaaaaaaaaaaaaaaaa" passes. No content rules.
7. **Reviewer is not notified.** The toast says "notified". Nothing sends a message.
8. **No review action.** An upload sits in "For Review" forever. No approve, reject or return.
9. **Bulk move and bulk delete skip the gate.** Moving a document changes its location with no comment. Delete has no reason field.
10. **Delete has no reason and no permission check.** Anyone can soft-delete any document.
11. **Edit has no reason field.** Title, folder and owner changes need no justification.

### Medium

12. **No concurrency control.** Two users can upload Rev N at once. Need optimistic locking on the revision number.
13. **No file type content check.** Extension only. A renamed file passes.
14. **No duplicate file check.** Same file can upload as many revisions.
15. **Search is substring only.** No full-text, no typo tolerance, no synonyms.
16. **Sorting and paging run in the browser.** Works at 5,000. Fails at hundreds of thousands.
17. **Drawer has no focus trap.** Keyboard users can tab behind it.
18. **Mobile layout not tested.** Table scrolls, drawer covers the screen. Not checked on a device.
19. **No retention or legal hold.** Deleted items persist with no schedule.
20. **No export.** No CSV, no transmittal list, no PDF register.

### Low

21. **No dark-mode visual check** in a real browser.
22. **Single-language UI.** No i18n. No date or unit localisation.
23. **No backup or restore plan.**
24. **Revision numbering is numeric only.** Letter revisions (A, B, C) not supported. Chosen in scope, but no switch exists.

## 3. Feature gap

### 3.1 Upload gate (requested)

| Requirement | Demo | Production gap |
|---|---|---|
| File required | Yes | Server must reject empty body. |
| File type allow-list | Extension check | Add MIME sniff and malware scan. |
| Size limit (50 MB) | Yes | Set limit at API gateway too. |
| Summary required (20–280 chars) | Length check | Add profanity and placeholder filter. Add reviewer-visible preview. |
| Comment for reviewer (10+ chars) | Length check | Same as summary. Store as thread, not single field. |
| Reviewer assigned | Dropdown | Must be a real user with edit rights on that project. |
| Gate on create | **Missing** | Add same gate to Rev 0. |
| Gate on bulk actions | **Missing** | Move needs reason. Delete needs reason. |
| Gate on edit | **Missing** | Title, folder, owner change needs reason. |

### 3.2 Review workflow (missing)

- Reviewer inbox: assigned revisions.
- Actions: Approve, Return with comment, Reject.
- Status changes logged with reviewer identity.
- Due date and overdue flag.
- Escalation rule when overdue.

### 3.3 Access control (missing)

- Entra ID sign-in (proposed in SCOPE.md).
- Roles per project: Viewer, Uploader, Reviewer, Project admin, Auditor.
- Folder-level rules. Auditor sees log, cannot edit.
- SharePoint permissions honoured through delegated Graph calls.

### 3.4 Audit log (partial)

Demo logs: create, edit, delete, restore, revision added.

Missing:
- Login and failed login.
- Download and view events.
- Permission changes.
- Before and after values on every field.
- Request ID and client IP.
- Hash chain or signed export for tamper evidence.
- Retention period for logs.

### 3.5 Storage and SharePoint (missing)

- Storage adapter interface.
- SharePoint driver via Microsoft Graph.
- Metadata DB to hold list data. SharePoint list views cap near 5,000 items.
- Checksum on upload. Compare on download.
- Virus scan before a revision becomes visible.
- Download link expiry.

### 3.6 Notifications (missing)

- Email or Teams message on assign, return, approve.
- Daily digest of overdue reviews.
- In-app bell.

### 3.7 Search and list (partial)

- Full-text search index.
- Saved views.
- Column chooser.
- Export to CSV and Excel.
- Transmittal builder: pick documents, produce a cover sheet.

### 3.8 Admin (missing)

- Project create, archive.
- User and role management.
- Folder template editor (EPC and Operations trees).
- Numbering rules per project.
- Retention rules per folder.

### 3.9 Quality (missing)

- No tests. Add unit tests for gate rules and revision logic.
- Add end-to-end tests for upload, review and delete.
- CI pipeline on push.
- Lint and format config.
- Accessibility check: keyboard path, screen reader labels, contrast.

## 4. Priority order

| Priority | Item | Why |
|---|---|---|
| P0 | Server-side gate on every write path | Client checks are not controls. |
| P0 | Append-only audit log | Required for document control. |
| P0 | Auth and roles | Nothing else is safe without it. |
| P1 | Review workflow with approve and return | Gate without review leaves revisions stuck. |
| P1 | Storage with checksum and virus scan | Upload must store real files. |
| P1 | Notifications | Reviewers must learn of assignments. |
| P2 | Full-text search, saved views, export | Needed at scale. |
| P2 | Retention and legal hold | Needed for handover and audit. |
| P3 | i18n, letter revisions, dark-mode polish | Nice to have. |

## 5. Decisions needed from you

1. **Reviewer role:** single reviewer, or two-step (checker then approver)?
2. **Create gate:** should Rev 0 need the same summary and reviewer?
3. **Bulk move and delete:** one shared reason for the batch, or one per document?
4. **Summary rules:** free text, or a fixed list of change reasons plus text?
5. **Retention:** how long to keep deleted items and logs?
