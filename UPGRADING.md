# Upgrading the Document Register without losing data

Date: 2026-11-06. Applies to the local app (`app/`) and the SharePoint web part (`app-spfx/`).

## The rule

Data never lives in the package. The package is code only. Upgrading code must never delete or reshape data without a backup.

## Local app (`app/`)

| What | Where | Upgrade behaviour |
|---|---|---|
| Database (projects, documents, revisions, audit log, settings) | `data/register.db` | Versioned with `PRAGMA user_version`. Current format: **2** (`DATA_VERSION` in `src/db.js`). |
| Stored files | `data/files/` | Never touched by an upgrade. Files are named, not moved. |
| Backups | `data/backups/` | Written automatically before any upgrade of existing data. Named `register-format<from>-<time>.db`. |

What happens on start:
1. If the database is at an older format, a full copy is written to `data/backups/` first (SQLite `VACUUM INTO`, safe while running).
2. Each missing step runs once, in its own transaction, in order (`MIGRATIONS` in `src/db.js`).
3. If any step fails, the transaction rolls back. The backup is still there.
4. If the database is from a **newer** version, the app refuses to open it. Nothing is changed.

Manual backup at any time:

    DMS_DATA=<data folder> node src/cli.js backup

Upgrade steps for a new version:
1. Stop the app.
2. Copy the whole `data/` folder somewhere safe (this includes `backups/`).
3. Replace the code (`src/`, `public/`). Keep `data/`.
4. Start the app. Check the console and `data/backups/` for the new backup line.

Rules for changing the format (for whoever maintains this):
- Never edit or delete an old migration step. Add a new numbered one.
- Bump `DATA_VERSION` with every new step.
- Add a test in `test/data-format.test.js` for any new step.

## SharePoint web part (`app-spfx/`)

| What | Where | Upgrade behaviour |
|---|---|---|
| Projects, types, folders, templates, documents, revisions, periods, certificates, audit | SharePoint lists | Not in the package. A package upgrade does not touch them. |
| Files | Library "Register Files" | Not in the package. Versioning is on, so overwritten files can be restored. |
| Site address (web part setting) | The SharePoint page | Kept across package upgrades while the component ID stays the same: `2e47d4a6-64cc-425e-92a1-5dd0dcf5b610`. **Never change this ID.** |
| Lists and columns | Provisioning script (`provisioning/`) | Idempotent. It only adds what is missing (`Ensure-List`, `Ensure-Field`). Re-running it is safe. |

Upgrade steps:
1. Back up the lists before any upgrade. In SharePoint: site contents, each list, Export to Excel, and keep the file. Turn on the Register Files library version history (already on).
2. Run the provisioning script on the test site first. Check that it reports no errors and changes nothing it should not.
3. Upload the new `.sppkg` to the app catalog as an update (same package name and ID). Test on the test site.
4. Only then update the production site.

Schema changes to SharePoint lists:
- Add columns only. Never rename or delete a column that holds data. Mark old columns unused in the docs instead.
- Each new column needs a provisioning line (`Ensure-Field`) and a line in the row mapping (`toRevision` etc.) that reads a missing value as empty.

## What is not yet built

- A scheduled export of the SharePoint lists (planned under item 25, audit export). Until then, use the manual backup above.
- A tested restore procedure for the SharePoint lists. Not built. The local app restore is copying a backup file back over `register.db` with the app stopped.

## Internal projects and SharePoint permissions (added 0.9.0)

- Members can create internal projects and edit their own. The web part enforces this.
- To allow that, members get Edit on the Projects, ProjectTypes and ProjectFolders lists.
- SharePoint cannot stop a member from editing a standard project directly in the list. The web part can. A list-level check would need a separate list for internal projects, or item-level permissions.
- Decision needed: accept this for the pilot, or keep internal projects in their own lists.
