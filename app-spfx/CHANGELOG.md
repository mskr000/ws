
## 0.4.0 (2026-11-06)
- Dashboard: needs you, missing and late uploads, certificates expiring or expired, progress by project.
- Transmittal: pick documents for a project, add recipient and purpose, save as CSV or copy text.
- SHA-256 checksum recorded for every uploaded file (revisions, recurring uploads, certificates).
- Provisioning adds a Checksum column to Revisions, PeriodEntries and CertificateVersions.
- Tests: 32 automated checks.
- Data format and upgrade steps: see UPGRADING.md.

## 0.5.0 (2026-11-06)
- Access tab for admins. Grant or remove permissions per person, per project or per folder. Presets: Records Lead, Admin.
- Permissions: upload to any document, remove and restore, change projects and templates, manage access. Enforced in the app.
- Keeps at least one admin.
- O&M (operations and maintenance) template: full folder structure, six document types. Sample project OM1 in the demo.
- Provisioning adds a Permissions list.
- Tests: 30 + 12 automated checks in the SharePoint package.

## 0.6.0 (2026-11-06)
- Working drafts on any document: add your own edited copy with a note. Not a revision, not checked or approved.
- Drafts are visible to their owner and to anyone who can edit any document. Owners and editors can discard.
- Draft file names stay out of the shared activity log.
- Provisioning adds a Drafts list.
- Known limit: SharePoint itself does not hide one member's draft from another member. The app hides it. Item-level permissions would close this.
- Tests: 33 + 12 automated checks in the SharePoint package.

## 0.7.0 (2026-11-06)
- Download on every file: revisions, monthly uploads, certificates, drafts.
- Files list on each document: select some, or all, and download. One file downloads directly; several come as one ZIP.
- Uncontrolled documents: a new type. Upload and version freely. No check or approval.
- Transmittals are recorded: numbered per project (TX-U100-0001), saved as a list file with a checksum, logged in the audit trail. Issued records cannot be edited.
- Email text built from the transmittal. Copy it; sending is not built yet. See TRANSMITTAL_DESIGN.md.
- Provisioning adds a Transmittals list.
- Tests: 38 + 12 automated checks.

## 0.8.0 (2026-11-06)
- Download is an icon with a tooltip and a label for screen readers.
- Revisions are separated by lines and spacing.
- Internal workspace template: one folder, uncontrolled documents only. Sample project INT in the demo.
- Any member can add uncontrolled documents to an internal workspace. Creating the workspace needs the projects permission.
- Tests: 38 + 12 automated checks.

## 0.9.0 (2026-11-06)
- Anyone can create an internal project and manage it: name, folders, document types, status.
- Standard projects still need the projects permission.
- Project kind (Standard or Internal) and owner are stored with each project.
- Members get Edit on Projects, ProjectTypes and ProjectFolders in provisioning. The web part limits them to internal projects they own. See UPGRADING.md.
- Tests: 40 + 12 automated checks.

## 0.10.0 (2026-11-06)
- Legal hold on a document. Placed or released by anyone with the remove permission, with a reason. Logged. Blocks removal.
- Retention: a document cannot be removed until 7 years after its last activity (default, see RETENTION_OPTIONS.md).
- Audit log export to CSV from the Activity tab.
- Power Automate flows parked until licence is confirmed (AUTOMATION_PARKED.md).
- Tests: 45 + 12 automated checks.
