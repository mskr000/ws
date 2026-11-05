# Document Management System: Scope v1

## Decisions

| Area | Decision |
|---|---|
| SharePoint | Not yet connected. Build a storage adapter first. Swap in Microsoft Graph later. |
| Stack | React + Vite (frontend), Node + Express (REST API). Default, user undecided. |
| Folders | Standard EPC phases plus Operations (below). |
| Revisions | Numeric: Rev 0, 1, 2, ... Status tracked separately. |

## Folder structure

```
/EPC
  01 Project Management
  02 Engineering
     02.1 Process
     02.2 Piping
     02.3 Electrical
     02.4 Instrumentation & Control
     02.5 Civil & Structural
  03 Procurement
     03.1 Requisitions
     03.2 Purchase Orders
     03.3 Vendor Documents
  04 Construction
     04.1 Method Statements
     04.2 Inspection & Test Plans
     04.3 Daily Reports
  05 Commissioning
  06 Handover
     06.1 As-Built
     06.2 O&M Manuals
/Operations
  01 Manuals
  02 SOPs
  03 Maintenance
  04 Permits
  05 Reports
```

## Revisions

- Each upload creates a new revision: Rev 0, Rev 1, Rev 2, ...
- Full history kept. Old revisions never deleted.
- Statuses: Draft, For Review, Approved, Superseded.
- Each revision stores: uploader, date, status, comment.

## Dashboard (frontend)

- Document counts by folder and status.
- Pending reviews.
- Recent revisions.
- Overdue reviews.

## Backend

- REST API: documents, folders, revisions, status.
- Storage adapter interface. Two drivers:
  - Local disk (v1 default).
  - SharePoint via Microsoft Graph (driver added once tenant is ready).
- Metadata stored in the API database.

## Out of scope v1

- Redlining and markup.
- Approval workflow engine.
- Mobile app.
- E-signature.
- ERP sync.

## Open items

- Microsoft 365 tenant, app registration, site URL: needed before SharePoint driver.
- Auth model for users: not yet decided. Proposed: Entra ID SSO once SharePoint is live.
