# Document Register: master feature list

Version: demo v0.21.0. Date: 2026-11-06. Branch: scope/dms-v1.

**Status key**
- **Built (demo):** works in the demo and is covered by tests. Not yet run on SharePoint.
- **Built (partly):** some of it works. The rest is listed under "Not built".
- **Not built:** not started, or parked.
- **Needs IT / licence:** cannot be finished without a decision from IT or a licence check.

**Where things are**
- Rules and logic (pure, tested): `app-spfx/src/domain/`
- Screens: `app-spfx/src/components/`
- SharePoint calls: `app-spfx/src/services/register.ts`
- Demo data and fake SharePoint: `app-spfx/preview/mockRegister.ts`
- Setup script for SharePoint lists: `app-spfx/provisioning/Provision-DocumentRegister.ps1`
- Demo file to open in a browser: `app-spfx/preview/document-register-preview-v0.21.html`

---

## 1. Sign-in and access

| Feature | How it works | Status |
|---|---|---|
| Windows sign-in | SharePoint signs people in with their work account. The web part reads who they are. | Built (design). Needs test site. |
| Permission grants | Admin gives a person a permission (edit any document, remove, change projects, manage access), for all projects, one project, or one folder. Revoking keeps the record. | Built |
| Presets | Member, Records Lead, Admin. Apply a preset to a person and a scope. | Built |
| Last-admin guard | The last admin cannot be removed. | Built |
| Records Lead group as admin | Until grants exist, members of the Records Lead group act as admin. | Built |

## 2. Documents

| Feature | How it works | Status |
|---|---|---|
| Document list | Filter by project, kind, text. Removed documents hidden unless asked. | Built |
| Controlled documents | Revisions. Each revision has a file, reason, summary, checker and approver. | Built |
| Check, approve, send back | Uploader cannot check or approve own work. Checker and approver must differ. | Built (rules tested) |
| Recurring documents | Monthly series with a due day and first month. Upload, replace, or mark not needed. | Built |
| Certificates | Versions with an expiry date. Renew. Expiring and expired states. | Built |
| Uncontrolled documents | A type with no check or approval. New versions. Latest is current. | Built |
| Remove | Marks the document removed and renames its file DELETED_… Nothing is erased. Needs the remove permission. | Built |
| Restore | Brings back a removed document. | Built |
| Legal hold | Blocks removal and renaming. Placed or released with a reason. Logged. | Built |
| Retention | Document cannot be removed until 7 years after last activity (default, to be confirmed). | Built (period needs decision) |
| Edit any document | Permission to upload a new version to someone else's document. | Built |

## 3. Files

| Feature | How it works | Status |
|---|---|---|
| Upload | File checked for allowed type (PDF, Word, Excel, DWG, ZIP), size up to 50 MB, not empty. | Built |
| Checksum | SHA-256 computed from the bytes when a file is uploaded. Stored with the revision, upload or certificate. | Built |
| Download, per file | Download icon on each revision, upload, certificate and draft. | Built |
| Bulk download | Select several files; one ZIP is made in the browser. | Built |
| Safe file names | Characters that SharePoint or Windows refuse are replaced. | Built |

## 4. Working drafts

| Feature | How it works | Status |
|---|---|---|
| Add a draft | Anyone with access adds their own copy with a note. Not a revision. | Built |
| Visibility | Owner and anyone who can edit any document see it. Others do not. | Built (app side). SharePoint cannot hide it from other members. |
| Discard | Owner or editor marks it discarded. Kept in the library. | Built |
| Check-out | Lock a document while someone edits it. | Not built |
| Draft to revision | Turn a draft into a revision. | Not built |

## 5. Projects and structure

| Feature | How it works | Status |
|---|---|---|
| Add project | Records Lead (standard). Any member (internal project). | Built |
| Edit project | Name, status, numbering, folders, document types. | Built |
| Archive | Status only. Projects are never deleted. | Built |
| Internal projects | Creator manages their own. Used for own or team work. | Built |
| Copy structure | New project from an existing one's folders, numbering and types. No documents. | Built |
| Numbering pattern | Tokens {PROJ}, {TYPE}, {SEQ:n}, {YYYY}. Locked once numbering starts. | Built |
| Document types | Per project: on or off, folder, first number. Off types are kept, not deleted. | Built |
| Folder tree | Indented, expand and collapse, document counts, add inside a folder. | Built |
| Rename folder | Renames the folder and everything in it. Documents move with it. Each move is logged. | Built |
| Remove folder | Marks the folder and everything in it as removed. Only if nothing in it holds documents. Restore brings it back. | Built |
| Templates | Built-in: EPC standard, Operations, Engineering drawings, O&M, Internal workspace. Saved templates from any project. | Built |
| CSV folder upload | Folder and type list from a CSV, with a list of errors. | Built |

## 6. Transmittals

| Feature | How it works | Status |
|---|---|---|
| Numbering | TX-PROJECT-0001, per project. Never reused. | Built |
| Recipients | Companies and their people. Select a company, tick people, or everyone. Selected people shown as cards. Removing a person marks them removed. | Built |
| Choose files | Browse folder tree, search by number or title, or paste numbers. One page at a time. Limit 200 files. | Built |
| Version and status per file | Each file shows its revision, file name and status: Current, Older version, Not approved yet, Sent back. | Built |
| Drafts excluded | Drafts are never offered for a transmittal. | Built |
| Confirm non-current | Sending with a file that is not current needs a tick. | Built |
| Send by email | From the issuer's own Microsoft 365 mailbox (Microsoft Graph, Mail.Send on behalf of the user). Attaches CSV list and PDF copy. | Built. Needs IT approval of Mail.Send. Not tested live. |
| Undo | 60 seconds after sending, undo cancels. Record kept, marked Cancelled. | Built |
| Send now | Skips the wait. Only the issuer. | Built |
| Held if page closed | Nothing sends automatically after the page closes. Shown in the list with Undo and Send now. | Built |
| PDF evidence copy | PDF saved with the record, with checksum. | Built |
| List file | CSV with number, title, version, file name, status, standing, checksum. | Built |
| Audit entry | Issue, send, cancel each logged. | Built |
| Copy email text | Text copied to paste into Outlook. | Built |
| Recipient email on record | Stored on the record. | Built |
| Power Automate sending | Alternative to the above, through a flow. | Not built. Needs licence. |

## 7. Plan and reporting

| Feature | How it works | Status |
|---|---|---|
| Dashboard | Needs you (checks, approvals, missing uploads, expiring). Progress by project. | Built |
| Calendar | Twelve months per recurring document, colour-coded. | Built |
| Master list | Every folder, what is filed in it, standing of each document. Empty folders shown as planned. CSV export. | Built |
| Heat map | Changes per project per day or per month, from the activity log. | Built |
| Audit log | Append-only in the app. Activity tab. | Built |
| Audit export, whole log | CSV from Activity tab. | Built |
| Audit export, one document | CSV from document page. | Built |

## 8. Notifications and automation

| Feature | How it works | Status |
|---|---|---|
| Reminders (recurring due, expiry) | Power Automate daily flow. Fallback: dashboard. | Not built. Parked. Needs licence. |
| Rule-breach alerts | Flow when someone edits SharePoint directly. | Not built. Parked. Needed before controlled documents go live. |
| Audit copy to second location | Flow copies each audit entry to a locked list. | Not built. Parked. Needs licence. |

## 9. Import

| Feature | How it works | Status |
|---|---|---|
| Import existing document list | Rename, folder fix, conflict handling, resume if stopped. | Not built. Waiting for the list files. |

## 10. Search at scale

| Feature | How it works | Status |
|---|---|---|
| Browse by folder | Tree, one page at a time. | Built |
| Search by number or title | Contains-match. Slow on large lists without an index. | Built (demo). Needs index on DocNumber and Folder. |
| Full-text search inside files | Later release. | Not built (proposed) |
| SharePoint Search for titles | Recommended for scale. | Not built |

## 11. Tests and checks

| Check | Count | Status |
|---|---|---|
| App rules and logic (Node tests) | 75 | Pass |
| SharePoint-layer rules (SPFx package) | 12 | Pass |
| Guard test: no code path deletes records, files, folders or projects | 1 (inside the 75) | Pass |
| Browser checks in the demo | Per version, see chat history | Pass |
| SharePoint live tests | 0 | Not built. Needs test site. |
| Pilot with named people | 0 | Not built. Needs test site and people. |

## 12. Deployment and IT

| Item | Status |
|---|---|
| SharePoint lists and library (provisioning script) | Written. Not run. Needs test site. |
| Web part package (.sppkg) | Builds on Node 20. Not uploaded. Needs IT app catalog approval. |
| Mail.Send API permission | Declared in package-solution.json. Needs IT approval. |
| Retention label (Purview) | Not set up. Needs IT and Microsoft 365 plan check. |
| IT request email | IT_EMAIL_DRAFT.md. Update before sending if anything changes. |

## 13. Decisions still open

1. Retention period (built default 7 years).
2. Whether any member can send transmittals, or only Records Lead.
3. Power Automate licence (reminders, alerts, audit copy).
4. Internal projects: accept members editing Projects, ProjectTypes, ProjectFolders lists in SharePoint (web part limits them).
5. Pilot people and test site.
6. Import: file format of the existing list.

## 14. Known limits

- SharePoint itself lets an admin with direct list access delete an item. Only a retention label stops that.
- Drafts are visible to other members in SharePoint unless item-level permissions are added.
- Rules are enforced in the web part. Direct SharePoint edits bypass them until alerts are built.
- Folder move (changing a folder's parent) is not supported. Rename only changes the last name.
- Transmittal email goes only from the signed-in person's mailbox.
