# Complete scope: Document Register (before any upload)

Date: 2026-11-06. Branch: `scope/dms-v1`.

Rule for this project: **nothing is uploaded to SharePoint until every item marked "Required" below is done and tested.** Re-uploading later changes the package for everyone who uses it, so it is not a casual step.

## 1. Where things stand

Two versions exist:

- **Local app** (`app/`): the most complete version. Runs on one computer. Not shared between people.
- **SharePoint web part** (`app-spfx/`): the version that can be shared. Has the document screens. Does not yet have project setup, drafts, transmittals, dashboard or several other items.

The target is the SharePoint web part with every feature from the local app and the gaps below.

## 2. Feature list and status

Status key: **Done** = built and tested. **Partial** = some of it built. **Missing** = not built.

| # | Feature | Local app | SharePoint web part | Needed for "complete" |
|---|---|---|---|---|
| 1 | Sign-in through Windows (automatic) | Stand-in | Done (SharePoint handles it) | Required |
| 2 | Document list, search, filter | Done | Done | Required |
| 3 | Add controlled, recurring and certificate documents | Done | Done | Required |
| 4 | Controlled workflow: check, approve, send back | Done | Done | Required |
| 5 | Recurring: monthly upload, replace, not needed | Done | Done | Required |
| 6 | Certificates: renewal, expiry status | Done | Done | Required |
| 7 | Remove and restore (renamed, not erased) | Done | Done | Required |
| 8 | Activity log | Done | Done | Required |
| 9 | Projects: add, edit, archive | Done | Done | Required |
| 10 | Numbering pattern per project, live example | Done | Done | Required |
| 11 | Document types per project: on/off, folder, first number | Done | Done | Required |
| 12 | Folder structure: add, remove (empty only), template | Done | Done | Required |
| 13 | Templates: built-in and saved | Done | Done | Required |
| 14 | Folder structure from CSV upload (with error list) | Done | Done | Required |
| 15 | Working drafts: private, check-out, submit | **Missing** | **Missing** | Required |
| 16 | Download a file (with checksum) | Done | Link only | Required |
| 17 | Import of an existing document list (rename, folder fix, conflicts, resume) | Missing (demo only) | Missing | Required |
| 18 | Transmittal (cover list) | Missing (demo only) | Missing | Required |
| 19 | Dashboard: needs you, KPIs, progress by project | Missing (demo only) | Missing | Required |
| 20 | Recurring calendar grid (12 months per series) | Missing (demo only) | Missing | Required |
| 21 | Master document list: planned versus uploaded | Missing | Missing | Required |
| 22 | Expiry and recurring reminders | Missing | Missing | Required, can be a later flow |
| 23 | Alerts when a rule is broken directly in SharePoint | n/a | Missing | Required before controlled documents |
| 24 | Full-text search inside files | Missing | Missing | Decide: later release |
| 25 | Audit export (one document, or all) | Missing | Missing | Required |
| 26 | Retention and legal hold | Missing | Missing | Required (policy decision) |
| 27 | Access review report | Missing | Missing | Decide: later release |
| 28 | Tests for the SharePoint layer | n/a | Missing | Required |
| 29 | Full pilot test with named users | n/a | Missing | Required |

## 3. What needs IT, and what does not

**Needs IT (one-time):**
1. Create the team site.
2. Let you deploy the `.sppkg` package (app catalog). Approve it if the tenant requires approval.

**Does not need IT, and does not need an app registration:**
- The web part calls SharePoint as the signed-in user. SharePoint does the sign-in. No token, no registration.
- Lists, library, groups, permissions and column setup: done by the site owner with the provisioning script.
- Project data, document types and templates: entered in SharePoint lists, or through the web part once item 9–14 are built.

**If IT will not deploy a package:** the register can still run on SharePoint lists and libraries alone. Approvals and reminders would then need Power Automate, which may need a licence. This is a weaker route. Ask IT about the package first.

## 4. Design decisions proposed (to be confirmed)

- **Drafts (item 15):** a "Drafts" library. Each draft is a file with its own permissions, visible only to its owner and the Records Lead. Submitting a draft creates the revision. Check-out is used to lock the document while a draft is open.
- **Import (item 17):** same rules as the local app. Rows that clash with an existing revision are skipped by default. Progress is saved to a list, so a stopped import can resume.
- **Transmittal (item 18):** a generated list (number, title, revision or period, purpose). Copied or saved as a file.
- **Reminders (item 22):** Power Automate flows, if licensed. Otherwise a manual "Due" view on the dashboard.
- **Rule enforcement (item 23):** the web part enforces the rules. Flows alert on any direct edit that breaks a rule. Full server-side enforcement needs a server, which you have not chosen.

## 5. Order of work

1. Projects, numbering editor, document types, folders, templates, CSV upload (items 9–14).
2. Download with checksum, import, and resume (items 16–17).
3. Drafts (item 15).
4. Transmittal, dashboard, calendar grid, master list (items 18–21).
5. Audit export, retention and legal hold (items 25–26).
6. Alerts and reminders (items 22–23).
7. Tests for the SharePoint layer and the pilot (items 28–29).

Items 24 and 27 are proposed for a later release. Confirm or move them into the required list.

## 6. Exit criteria (all must be true before upload)

- Every "Required" item is built in the SharePoint web part.
- Every item has a passing test. Rules tests run on Node. SharePoint tests run on a test site.
- A full run-through on a test site, start to finish: create project, add documents, check, approve, recur, renew, remove, restore, import, export.
- Provisioning script run on a clean test site with no errors. Permissions checked by hand.
- IT request sent and approved.
- Security review of section 5 of `SHAREPOINT_PLAN.md`: the accepted risk is written down and signed off.

## Status update 2026-11-06 (demo v0.9.0)

Done in the demo and the code (tested in the browser and in the rules tests):
9–14 projects, numbering, types, folders, templates, CSV · 15 working drafts (no check-out yet) · 16 download icon, checksum, bulk ZIP · 18 transmittal recorded, email text (copy only) · 19 dashboard (needs you, KPIs, progress) · internal projects · admin access · uncontrolled documents · O&M template.

Not done, in suggested order:
1. Import of an existing list, with resume (17).
2. Calendar grid of 12 months per series (20) and master list (21).
3. Audit export (25).
4. Retention and legal hold (26). Needs a policy decision.
5. Reminders and rule-breach alerts (22, 23). Needs a Power Automate licence decision.
6. Check-out for drafts. Tests for the SharePoint layer (28). Needs a test site.
7. Pilot with named people (29).

Later release (proposed, not yet agreed): full-text search (24), access review report (27).

Blocked on you: test site address, IT request sent, licence and retention decisions, pilot people.
