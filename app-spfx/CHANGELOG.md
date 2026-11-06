
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
