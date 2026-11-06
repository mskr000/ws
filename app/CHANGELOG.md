# Changelog

## 0.1.0 (2026-11-06)
- First working version. Controlled, recurring and certificate documents.
- Server-side rules, numbering streams, audit log that cannot be edited.
- Downloads with checksums. Remove and restore for the records lead.
- Tests: rules and service (20 checks). Browser check of the page.

## 0.2.0 (2026-11-06)
- Projects: add a project with its own code, name, folder structure and document types.
- Folder structure starts from the standard template. Add or remove folders. A folder with documents cannot be removed.
- Each document type is turned on or off per project and files into one folder.
- Numbering is automatic per project and type. An optional first number continues an existing register.
- Project codes cannot change once documents exist. Numbering cannot restart once it has started.
- Only the records lead can add or change a project. Every change is in the audit log.
- Tests: 30 automated checks.

## 0.3.0 (2026-11-06)
- Numbering pattern per project, e.g. `{PROJ}-{TYPE}-{SEQ:4}` or `{PROJ}.{TYPE}.{YYYY}.{SEQ:3}`. Live example on the form.
- Pattern is locked once numbering has started.
- Built-in templates: EPC project (standard), Operations (plant running), Engineering drawings only.
- Save any project setup as a named template (records lead).
- Folder structure from a CSV file (`folder,types`). Errors are listed; nothing changes if the file has problems.
- Full document type library (19 types) on the server.
- Tests: 39 automated checks.

## 0.4.0 (2026-11-06)
- Data format 2. Upgrades run as numbered steps, each once, in a transaction.
- A full backup is written to `data/backups/` before any upgrade of existing data.
- A database from a newer version is refused, not changed.
- `node src/cli.js backup` writes a backup on demand.
- Tests: 43 automated checks.
