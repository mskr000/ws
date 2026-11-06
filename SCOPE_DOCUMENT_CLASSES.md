# Scope: Document Classes (controlled, periodic, records)

Date: 2026-11-06. Branch: `scope/dms-v1`. Status: scope only. No build yet.

## 1. The problem

The register treats every file the same. Each file gets revisions, a checker and an approver.

That fits engineering drawings. It does not fit:

- **Monthly reports and checks.** A monthly operations report or a monthly pump vibration check. Each month is a new file. Nobody approves it. It only has to arrive on time.
- **Certificates and permits with an expiry.** A pressure vessel certificate is valid until a date. It needs a renewal, not a revision.
- **Other one-off uploads.** Meeting minutes, site photos, daily logs. Upload and file. Nothing more.

## 2. Options considered

| Option | Idea | Verdict |
|---|---|---|
| A. Separate system for recurring items | Build a second app for monthly items | Rejected. Two systems to search, audit and back up. Users split. |
| B. Flags on every document | Turn workflow on or off per document | Rejected. Easy to misuse. Each document becomes its own rule set. Hard to audit. |
| C. Document class per type, with a policy | Each type belongs to one class. The class sets the workflow, the schedule and the required fields. | **Recommended.** One register. Rules set once, per type. Easy to explain. Easy to audit. |

## 3. Recommended design: three classes

| Class | Used for | Workflow | Unit of work | Validity |
|---|---|---|---|---|
| **Controlled** | Drawings, specs, procedures, manuals | Upload, check, approve. Only one Current. Revisions. | Revision (Rev 0, 1, 2) | Current until a newer revision is approved |
| **Periodic** | Monthly reports, monthly checks, weekly logs | Upload only. Owner is responsible. Optional owner acknowledgement. | Period (2026-10) | Each period is on time, late or missing |
| **Record** | Certificates, licences, permits with an expiry | Upload with expiry date. Optional approval (set per type). | Version (renewal) | Valid, expiring (30 days), expired |

Rule: **a type has one class.** A document inherits its class from its type. Nobody picks the class per document.

## 4. Data model

```
Document      id, project, type, class, number, title, folder, owner, status(active|removed)
  Controlled  revisions[]     { n, status(Submitted|Checked|Approved|Returned|NotOnFile),
                                 summary, reason, file, by, checker, approver, checkedBy, approvedBy }
  Periodic    schedule { frequency: monthly, dueDay (1-28), startPeriod }
              periods{}       key "2026-10" -> { file, summary, by, uploadedAt, dueAt,
                                                  state(uploaded|late|na), naReason, replaces[] }
  Record      versions[]      { n, file, summary, by, uploadedAt, expiresOn, approval? }
Audit         append-only, every write, same transaction
```

Numbering stays as agreed: `PROJECT-TYPE-0001`. Periods are **not** numbered. The period key is part of the file name:
`U100-RPT-0001_2026-10.pdf`.

## 5. Periodic rules (the part that needs care)

1. **Series is one document.** "Monthly operations report, Unit 100" is one document with twelve periods a year.
2. **Due date is fixed in the series.** Example: due on the 5th of the following month. Changing the due day creates a log entry and applies from the next period.
3. **States are computed, not typed.**
   - `Uploaded`: file present, on time.
   - `Late`: file present, uploaded after the due date.
   - `Missing`: no file, due date passed.
   - `Open`: current period, not due yet.
   - `Upcoming`: future period.
   - `Not applicable`: owner marked it with a reason. Counts as complete. Reason is required.
4. **Correcting a period** uploads a replacement. The old file is kept. The replacement records why. Only the latest is shown as current.
5. **Missed periods stay missed.** Uploading late does not change the `Missing` history. It becomes `Late`.
6. **Removing a series** does not delete periods. Removed series stop reminders. History stays.
7. **Start period.** A series starts at a stated month. Earlier months are not created.
8. **Year rollover** is automatic. Periods are generated from the start month forward.

## 6. Record rules

1. Expiry date is required on every version.
2. Status: `Valid` (more than 30 days left), `Expiring` (30 days or fewer), `Expired`. Thresholds are per type.
3. Renewal is a new version with a new expiry. The old version stays.
4. If the type needs approval, the controlled workflow applies. Otherwise upload only.

## 7. Who can do what

| Action | Controlled | Periodic | Record |
|---|---|---|---|
| Create document | Project member | Project member | Project member |
| Upload | Project member | Series owner | Owner or uploader |
| Check | Named checker (not uploader) | not used | optional |
| Approve | Named approver (not uploader or checker) | not used | optional |
| Mark not applicable | not used | Series owner, reason required | not used |
| Remove | Project admin | Project admin | Project admin |
| Restore | Project admin | Project admin | Project admin |

## 8. Reminders and dashboard

- Owner gets a reminder 5 working days before a due date, and on the due date.
- Dashboard for each person: what is due, late, missing, expiring, waiting for them.
- Project dashboard: percent of periods on time this year. Percent of controlled items approved. Records expiring in 30 and 90 days.
- Reminders need a scheduler and an email or Teams connection. Not built.

## 9. Folder rules

Recurring and record types need homes in the folder structure:

- Monthly reports → `Operations/05 Reports`
- Monthly maintenance checks → `Operations/03 Maintenance`
- Certificates and licences → **new folder `Operations/06 Certificates`** (to be agreed)

## 10. Import rules

- Controlled rows: unchanged. Revisions map to revision numbers.
- Periodic rows: one row per period. Period key required. Series created from the first row if missing.
- Record rows: one row per version. Expiry date required.

## 11. Security and audit (additions)

- Periodic uploads and not-applicable marks are logged with reason.
- Record expiry changes are logged. An expiry cannot be shortened without a reason.
- Owner reassignment is logged. Series can be reassigned only by a project admin.
- Reminders must not expose documents to people outside the project.

## 12. Open decisions for you

1. Which types are periodic, and which are records? (Draft list is in the demo.)
2. Due-day rule for each periodic type. Calendar day, or working day?
3. Which records need approval? (Certificates usually do not. Permits may.)
4. Expiry warning window: 30 days default. Confirm.
5. Are "not applicable" periods allowed for all periodic types, or only some?
6. Who may create a recurring series? Project admin only, or any member?

---

## Critique of the current demos (what must be fixed)

These are gaps in the register demos we built. Fix before any real build.

1. **Every type uses the same workflow.** A monthly report should not need a checker. This is the main flaw this scope fixes.
2. **"Current" and "Latest" mean nothing for periodic items.** They need `Latest period` and `Missing periods` instead.
3. **Numbering assumes one file per number.** Periodic items need series numbers plus period keys.
4. **Folder list is incomplete.** Certificates have no home. Needs a decision.
5. **Removing one item in a series creates a hole.** Removing must not remove periods silently. Show as `Removed`.
6. **Import only understands revisions.** It needs the period and record mappings above.
7. **No due dates, reminders or expiry logic anywhere.** Recurring work will be forgotten without this.
8. **Rules are enforced in the browser only.** Same risk noted in SECURITY_SCOPE.md. A server must enforce class rules.
9. **No "Not applicable".** Real plants have months with nothing to report. Without this, owners will mark periods late to get out of the red.
10. **Owner is one name, not a role.** People leave. Series need a role-based owner (for example "Unit 100 operations lead").

## What else the system can benefit from

Ranked by value for an EPC or operations team:

1. **Master document list (MDL) with planned versus actual.** Every planned document is listed before work starts. Shows what is still missing. Used for handover readiness.
2. **Transmittals.** Pick documents, produce a cover list with numbers, revisions and purpose. Common in EPC. Saves hours of email.
3. **My work inbox.** One list per person: to check, to approve, due, expiring.
4. **Expiry and compliance tracker.** Certificates, licences, permits, inspections. Warnings at 90, 30 and 7 days.
5. **Handover package completeness.** Per system or per tag: is every as-built and O&M manual in? Shows gaps before handover.
6. **Full-text search inside files.** Needs text extraction (PDF text, OCR for scans). Finds a tag number inside a drawing.
7. **Related documents.** Link a P&ID to its line list, datasheet and isometric. Click through.
8. **Access review.** Quarterly report of who can see or change each project. Needed for audit.
9. **Retention report.** Which items are due for purge, and which are on legal hold.
10. **Audit export.** One click export of the activity for a document or a period, for an auditor.

## Recommended order

1. Document classes (this scope). Blocks everything else.
2. Master document list. Gives the project a plan to measure against.
3. My work inbox and reminders. Needs classes and due dates.
4. Transmittals. Needs the register to be trusted first.
5. Expiry tracker. Reuses the reminder engine.
6. Handover completeness. Needs the master list.
7. Full-text search. Heavy. Needs its own scope.

---

## Addendum: Personal working drafts (scope only)

Date: 2026-11-06.

### Problem

People need to work on a document before anyone else sees it. Examples: marking up a revision, drafting a monthly report, preparing a certificate renewal. Today the register has no private space.

### Rules

1. **Drafts are private.** Only the owner sees a draft. Drafts do not show as Current, Latest or Waiting.
2. **Drafts are not revisions.** A draft becomes a revision only when the owner submits it.
3. **Start from the current file.** "Start working on a revision" copies the Current file (or the latest file) into the owner's draft.
4. **Check-out lock (recommended).** Starting a draft locks the document for editing by others, with a visible "in draft by X since date" flag. Lock expires after a set time (for example 10 working days) and the owner or records lead can release it.
5. **Each upload to a draft is a draft version.** Old draft versions are kept, so a bad edit can be rolled back.
6. **Submit** creates the revision (controlled), the period (recurring) or the renewal (certificate), with summary, reason and checker/approver as before.
7. **Discard** removes the draft from view, keeps its versions in the audit log, and releases the lock.
8. **Drafts in exports.** Transmittals and exports never include drafts unless the owner chooses it.

### Download and upload

- Download gives a copy. The original stays in the register.
- Editing happens on the owner's computer, in the owner's own applications.
- Uploading back goes to the draft, not to the register.
- In SharePoint, this maps to native check-out and check-in. Draft folders per person are restricted to that person and the records lead.

### Who can do what

| Action | Owner | Others | Records lead |
|---|---|---|---|
| Start draft | Yes (locks document) | No | Can release lock |
| Upload draft version | Yes | No | No |
| Download draft | Yes | No | Yes (for support) |
| Submit draft | Yes | No | No |
| Discard draft | Yes | No | Yes |

### Critique and risks

1. **Lock abandonment.** Drafts left open block everyone. Needs an expiry and a reminder.
2. **Two people, one draft.** Only one editor at a time, enforced by the lock. Cannot merge.
3. **Private does not mean secret.** The records lead can see drafts for support. This must be stated to users.
4. **Draft numbers.** Decide whether a draft uses a number now. Recommended: numbers are assigned on first submit, so no gaps appear.
5. **Audit.** Draft starts, uploads and discards are logged. Draft content is not.
6. **Storage.** Draft versions grow fast. Need a cap or a clean-up rule.
7. **Permissions in SharePoint.** Personal draft folders must not be readable by project members. Test this before go-live.

### Open decisions

1. Lock expiry time: 10 working days proposed.
2. Are drafts visible to the project admin, or to the records lead only?
3. Should draft numbers be reserved?
4. Maximum draft versions kept per person.
