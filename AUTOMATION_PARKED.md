# Parked: flows that need Power Automate

Date: 2026-11-06. Status: **parked. Not built. Waiting for a licence check.**

I have no access to your Microsoft 365 tenant, so I cannot tell whether Power Automate is licensed for you. Check it as shown in RETENTION_OPTIONS.md. If it is included, these can be built. If not, they stay parked. Each one below works the same without automation: the app shows the same information on the dashboard.

## 1. Reminders (item 22)

- **Trigger:** every day at 07:00.
- **Logic:** read the Documents and PeriodEntries lists. For each recurring series, if the current month has no upload and today is at least 3 days before the due day, or past it, send a reminder to the owner. For each certificate expiring within 30 days, remind the owner.
- **Replacement without the flow:** the dashboard "Needs you" and "Missing uploads" panels. Built.
- **Licence:** Power Automate, standard connector to Outlook.

## 2. Rule-breach alerts (item 23, required before controlled documents)

- **Trigger:** when an item in Revisions or Documents changes.
- **Logic:** if the person who changed Status to Checked or Approved is the same person as Uploader, or the same as Checker when approving, send an alert to the Records Lead and write a row in the audit list marked "Direct edit, rule check".
- **Why it matters:** the app blocks these, but anyone with direct list access can make the change in SharePoint. This flow is the only detection for that.
- **Replacement without the flow:** none. Until built, direct edits are not detected. The SHAREPOINT_PLAN.md section 5 risk applies.
- **Licence:** Power Automate.

## 3. Audit copy to a second location (SHAREPOINT_PLAN section 5)

- **Trigger:** when an item is added to AuditLog.
- **Logic:** copy the row to a second list (AuditCopy) that only the Records Lead can read, or to a locked library.
- **Replacement without the flow:** the audit CSV export in the Activity tab. Built. Run it monthly and store the file.
- **Licence:** Power Automate.

## Decision

Build 1, 2 and 3 once the licence is confirmed. Item 2 comes first. Before controlled documents go live, item 2 must be in place or the risk must be accepted in writing.
