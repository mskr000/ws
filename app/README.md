# Document Register (app)

A document register for EPC and operations documents. Three kinds of document:

- **Controlled**: drawings and procedures. Upload, check, approve. One Current version.
- **Recurring**: monthly reports and checks. Upload each month on time. No approval.
- **Certificate**: certificates and permits with an expiry date. Renew before expiry.

Rules are enforced on the server. Every write is in an append-only audit log.

## Run it on your computer

Needs Node.js 22.13 or later (https://nodejs.org). No other installs.

```
cd app
node src/cli.js seed      # first time only: creates the database with demo content
node src/cli.js           # starts the app
```

Open http://127.0.0.1:8787 in your browser.

To start again from nothing: stop the app, delete the `data` folder, run `seed` again.
For an empty register with no demo content: stop the app, delete `data`, run `node src/cli.js`.

## Where the data is

- `app/data/register.db`: the database (projects, documents, revisions, periods, audit log).
- `app/data/files/`: the uploaded files, named by their checksum.

**Backup:** stop the app, copy the whole `app/data` folder somewhere safe, start the app again.

## Projects

Projects tab → **Add a project**. Set:

1. **Basics:** code (2 to 5 capitals or digits, e.g. U100) and name.
2. **Folders:** start from the standard EPC and Operations structure. Add or remove folders.
3. **Document types:** turn on the types the project uses. Each files into one folder. Set a first number to continue an existing register.

Only the records lead can add or change a project.

### Numbering

Each project has a numbering pattern. Tokens: `{PROJ}` project code, `{TYPE}` document type,
`{SEQ:4}` running number padded to 4 digits (required, once), `{YYYY}` year.
Examples: `{PROJ}-{TYPE}-{SEQ:4}` → U100-PID-0001. `{PROJ}.{TYPE}.{YYYY}.{SEQ:3}` → U100.PID.2026.001.
The sequence continues across years. The pattern cannot change once numbering has started.

### Folder structure from a CSV

Columns: `folder`, `types` (optional, codes separated by `;`). Example:

```
folder,types
EPC/02 Engineering/02.1 Process,PID;PFD
EPC/02 Engineering/02.2 Piping,ISO
Operations/03 Maintenance,MNT
```

If no row has types, standard filing is used: each type goes to its standard folder if that folder is in the file.

### Templates

Start a new project from a built-in template (EPC standard, Operations only, Engineering drawings only),
or from a template you saved from an existing project.

## Sign-in (development only)

The "Signed in as" list is a stand-in. Anyone on this computer can pick any name. Company sign-in
(Windows or Microsoft 365) replaces it before real documents are loaded. See `../BUILD_PLAN.md`.

The server only listens on 127.0.0.1, so other computers on the network cannot reach it.

## Tests

```
npm test
```

Runs the rules and the service checks. Both must pass before a change is accepted.

## Layout

- `src/rules.js`: business rules. No database. Easy to review.
- `src/db.js`: schema. The audit table cannot be changed or deleted (database triggers).
- `src/service.js`: every write, inside one transaction, with an audit entry.
- `src/server.js`: HTTP routes and security headers.
- `src/seed.js`: reference lists and demo content.
- `public/`: the web page (plain HTML, CSS and JavaScript, no build step).
- `test/`: automated checks.
