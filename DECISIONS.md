# Decisions: Document Register v1

Date: 2026-11-05. Branch: `scope/dms-v1`.

## Upload and create gate
- Fields: file, reason code, summary (20–280 chars), reviewer comment (10+ chars), checker, approver.
- Reason codes: DES design change, CLI client comment, VEN vendor data, ERR error correction, SCO scope change, ASB as-built, OTH other. HIST is import only.
- Create (Rev 0) uses the same gate.
- Bulk move, bulk delete, and edit need one reason code and 20+ characters of text.

## Review workflow
- Uploader cannot check or approve their own revision.
- Checker and approver must differ.
- Flow: Submitted → Checked → Approved. Or Returned, with reason text (10+ chars).
- Only the assigned checker or approver can act.
- Only Approved revisions can become Current.

## Existing revisions and gaps
- Import from CSV manifest. Columns: doc_no, title, rev, status, date, reason, summary, file_name, by.
- Import never overwrites a revision already on file.
- Import can fill missing revisions. Gaps become "Not on file" placeholders. No file is invented.
- Placeholders cannot be Current.
- Upload can fill a placeholder slot (Rev N, fill missing).
- Historical import statuses: Approved, Returned, Draft.

## Delete and retention
- Delete is soft. Document is flagged deleted and renamed in SharePoint to `DELETED_<YYYYMMDD>_<original>`.
- No SharePoint file is removed.
- Restore clears the flag and renames back.
- Purge date: deletion + 365 days. Policy only. Purge job not built.
- Audit log: append-only. Kept 7 years. Never edited or removed.

## Open
- Checker and approver lists: source of truth is project membership (not built).
- Purge job design and legal hold (not built).
- Reason code list: confirm with QA.

## Decisions taken 2026-11-06

- **Internal projects open to members (agreed).** Any member creates and manages their own internal project. SharePoint cannot limit members to internal projects; the web part does. Accepted for the pilot, with the audit log as the check. Revisit before production.
- **Email for transmittals (recommended).** Copy and paste for the pilot. Power Automate after IT and licence are confirmed.
- **Uncontrolled documents.** Type "Working document (uncontrolled)". Lives in a project. Internal workspace template for personal or team use.
- **Working drafts.** Visible to owner and editors only. Not revisions.
- **Admin model.** Permission grants per person, project and folder. At least one admin always kept.
