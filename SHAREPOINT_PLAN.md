# SharePoint build plan: Option B (page inside SharePoint)

Date: 2026-11-06. Branch: `scope/dms-v1`. Status: plan. Build starts after the IT request is sent.

## 1. What we are building

A **SharePoint Framework (SPFx) web part** called "Document Register". It sits on a SharePoint Online site page.

- People open the page in their browser. SharePoint signs them in through Windows (AD) automatically.
- Metadata lives in **SharePoint lists**. Files live in a **document library**.
- The app runs in the user's browser. It reads and writes SharePoint with that user's own permissions.
- No separate server. No app registration needed for the core, because SPFx calls SharePoint as the signed-in user.

## 2. What IT must do (one request)

Send this to IT:

> Please set up the following for the Document Register in Microsoft 365 (SharePoint Online):
> 1. A team site called **Document Register** (one test site, one production site).
> 2. Deploy access for a SharePoint Framework package: confirm the tenant app catalog exists, and let the project owner upload and approve one `.sppkg` package.
> 3. Two SharePoint groups on the site: **Register Members** (Contribute on the library and lists) and **Register Records Lead** (Full Control). Use existing groups if they already fit.
> 4. A document library called **Register Files** with versioning and check-out turned on.
> 5. Confirm that staff devices are Entra-joined or hybrid-joined, so Windows sign-in is automatic in the browser.
> 6. (Optional) Purview retention label for 7 years on the audit list.
>
> No new app registration is needed for the core. We will tell you if we later need access to another API.

Notes for IT:
- A SharePoint Framework web part normally uses the signed-in user's session. An API permission request is only needed for other services.
- The package is small, and contains only the web part code.

## 3. Data model in SharePoint

| List or library | Holds | Key columns |
|---|---|---|
| Projects | One row per project | Code (unique), Name, Status, NumberPattern, Locked |
| ProjectFolders | Folder tree per project | Project (lookup), Path (unique with Project) |
| ProjectTypes | Types turned on per project | Project, TypeCode, Folder, FirstNumber |
| DocumentTypes | Type library (19 types) | Code, Label, Kind (Controlled, Recurring, Certificate), DefaultFolder |
| Documents | One row per document | Number (unique), Project, Type, Kind, Title, Folder, Owner, Deleted, SharePointName, DueDay, StartPeriod |
| Revisions | Controlled documents | Document, N, Status, Reason, Summary, Note, Uploader, Checker, Approver, CheckedBy, ApprovedBy, ReturnNote, FileUrl |
| PeriodEntries | Recurring documents | Document, Period (2026-10), Version, NotNeeded, NotNeededReason, Summary, Uploader, UploadedAt, FileUrl |
| CertificateVersions | Certificates | Document, N, Summary, ExpiresOn, Uploader, FileUrl |
| AuditLog | Every write | When, Who, Action, Document, Detail |
| Templates | Saved project templates | Name, Description, Body (JSON text) |

Files are in **Register Files**. Each file is named by its document number and revision, for example `U100-PID-1001_r2.pdf`. Removed documents are renamed `DELETED_<date>_<name>`, as before.

## 4. Who can do what (SharePoint permissions)

| Action | Members | Records Lead |
|---|---|---|
| Add documents, revisions, period uploads | Yes | Yes |
| Check and approve | Named people only (app checks) | Yes |
| Remove and restore | No | Yes |
| Change projects and templates | No | Yes |
| Edit or delete audit entries | No | No (see section 5) |
| Delete files in the library | No | No (rename only) |

## 5. Honest limits: what SharePoint can and cannot enforce

This is the most important section. Read it before approving.

| Rule | How it is enforced | Weakness |
|---|---|---|
| Uploader cannot check or approve own work | The web part checks it before saving | A person with edit access to the list could change the data directly. Mitigation: a Power Automate flow compares Uploader with CheckedBy and ApprovedBy on every change and alerts the Records Lead. |
| Checker and approver differ | The web part checks it | Same as above. Flow alert. |
| Numbering never reused | The web part reads the highest number. The Number column has a unique index. | None significant. |
| Audit log cannot be edited | Members can add but not edit or delete. Version history is on. | The Records Lead (site owner) can still change it. Mitigation: a flow copies every audit entry to a second, locked location. Full protection needs a separate immutable store, decided later. |
| Removal is records-lead only | Web part and list permissions | A site owner can still delete. Mitigation: recycle bin and version history. |

**Decision needed:** Are these weaknesses acceptable for the first pilot? My view: yes for drafts, reports and certificates. For controlled documents, add the flow alerts before pilot use, and plan the immutable audit store.

## 6. SharePoint limits to design for

- **5,000-item list view threshold.** Index Project, Type, Number and Status columns. Page all queries. The audit list is split by year.
- **File size.** Up to 250 MB per file in SharePoint. Our rule is 50 MB.
- **Versioning.** Turned on for Register Files and the lists. Gives rollback for free.
- **Concurrency.** Each item has an ETag. The web part sends it when saving, so two people editing the same item get a clear conflict message.

## 7. Technical plan

- **Stack:** SPFx (React), TypeScript. Calls SharePoint REST through `@pnp/sp`.
- **Shared rules:** the pure rules in `app/src/rules.js` are ported to TypeScript in `app-spfx/src/rules.ts`, with the same tests. Tests run in Node.
- **Repository layout:**
  - `app-spfx/`: SPFx solution (web part, rules, services, tests).
  - `app/`: the earlier local app. It stays as the reference and test source.
- **Build:** `npm install`, `gulp bundle --ship`, `gulp package-solution --ship` produces the `.sppkg`.
- **Deploy:** upload the `.sppkg` to the app catalog. Add the web part to a page on the test site.

## 8. Phases

| Phase | What | Who | Blocked by |
|---|---|---|---|
| 0 | Send IT request. Confirm the flow alerts are acceptable. | You | Nothing |
| 1 | Scaffold SPFx solution. Port rules and tests. Build the `.sppkg`. | Me | Nothing |
| 2 | Create lists and library from a provisioning script on the test site. | Me, you run it | IT site |
| 3 | Web part: projects, documents, revisions, periods, certificates. | Me | Test site |
| 4 | Permissions, flows (alerts, audit copy). | Me + you | Records Lead group |
| 5 | Test with 3 people for two weeks. Fix. | You | Phase 3 |
| 6 | Production site, go-live. | You + IT | Phase 5 |

I can do phases 1 and 3 without your tenant (build, tests, local checks). Phases 2, 4 and 5 need the tenant and your people.

## 9. What I need from you

1. Your SharePoint site address (or confirm IT will create the test site).
2. Confirm the risk in section 5 is acceptable for the pilot, with flow alerts.
3. Send the IT request in section 2.
