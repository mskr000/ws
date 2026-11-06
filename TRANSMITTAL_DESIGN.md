# Transmittals: how they are recorded, and the email text

Date: 2026-11-06. Applies to `app-spfx/` v0.7.

## What a transmittal is

A dated record that says: these documents, at these revisions, were sent to this person, for this reason. It is the proof of what was sent.

## How it is recorded (system)

Each transmittal is one row in the **Transmittals** list and one CSV file in the **Register Files** library.

| Field | Example | Notes |
|---|---|---|
| Number | TX-U100-0004 | Per project. Never reused. Set by the system. |
| Project | U100 | |
| Sent to | Client A | Required. |
| Purpose | For review | Required. Free text, one line. |
| Notes | Vent notes changed | Optional. |
| Documents (as issued) | JSON: number, title, where it stood | A snapshot. It does not change later, even if the document does. |
| List file link | …/TX-U100-0004.csv | The list as sent. Downloadable. |
| SHA-256 checksum | … | Of the list file. Proves it was not changed. |
| Issued date | 2026-11-06 | Set by the system. |
| Issued by | Sam | Signed-in name. |

Rules:
- Issuing writes the row, the file and an audit entry together. The record is "Add only": nobody edits or deletes an issued transmittal.
- A transmittal needs at least one document, a recipient and a purpose.
- "Save as CSV" on the page downloads a copy without recording it. Use it for drafts only.
- Revisions are recorded as they stood at issue. Later revisions do not change an old transmittal.

## Email text

The register builds the text. It does not send it yet.

Subject:
`Transmittal TX-U100-0004 · Unit 100 Refinery · For review`

Body:
```
Dear <Sent to>,

Please find transmittal TX-U100-0004 dated 2026-11-06 for review.

Documents on this transmittal:
  - U100-PID-1001 Pump layout, Unit 100 (Current: Rev 1)
  - …

The transmittal list is attached as a file. The files are available from the register on request.

Regards,
<Issued by>
```

Rules for the text:
- If no recipient name is given, it starts "Hello,".
- The purpose is lower-cased in the sentence.
- Attach the saved list (`TX-…csv`). The email does not contain file links.

## Sending the email (not built)

Options, in order of effort:
1. **Copy and paste** (built). The user pastes into Outlook and attaches the list.
2. **Power Automate flow** on the Transmittals list: when a row is added, email the recipient with the subject and body, and the list attached. Needs a licence for the flow and a mail account. Lets the register write the audit entry "emailed to …".
3. **Graph API from the web part.** Needs an app registration and IT approval for mail permissions. Not recommended for the first release.

Decision needed: which option. My recommendation: option 1 for the pilot, option 2 after IT agrees.

## What is not decided

- Who may issue a transmittal. Built: any member. Could be limited to the Records Lead or to editors.
- Whether the recipient's email address is stored. Not stored now.

## Status: what is built and what is not (2026-11-06)

| Part | Built | Notes |
|---|---|---|
| Choose documents, add recipient and purpose | Yes | Demo and code |
| Number per project (TX-U100-0001) | Yes | Never reused |
| Record the transmittal (list in the register) | Yes | Demo; SharePoint side not tested |
| Save list file with checksum | Yes | Uploaded to the library |
| Audit entry | Yes | Logged on issue |
| Email text | Yes, copy only | Copy, paste into Outlook, attach list |
| Send the email from the register | **No** | Needs Power Automate (licence) or mail permission (IT) |
| Record that the email was sent | **No** | Part of the sending flow |
| Recipient email address stored | **No** | Add a field when sending is built |

## How sending would work (once Power Automate is confirmed)

1. A transmittal row is added to the Transmittals list.
2. A flow starts. It reads the row, builds the email from the same text, and attaches the list file.
3. The flow sends it from the company mailbox to the recipient address.
4. The flow writes back "sent to [address] on [date]" and an audit entry.

Without a licence: stay with copy and paste. Nothing is lost.


## Update 2026-11-06 (v0.17): sending is built

| Part | Built | Notes |
|---|---|---|
| Recipient email, stored on the record | Yes | Checked before sending |
| Send from the register | Yes | From the issuer's own mailbox (Microsoft Graph, Mail.Send, on behalf of the user) |
| Undo for 60 seconds | Yes | Undo marks the record Cancelled. Nothing is deleted. |
| Send now | Yes | Only the issuer |
| PDF copy kept as evidence | Yes | Saved with the record, with checksum |
| Record that it was emailed | Yes | Status, sent time, audit entry |
| Held transmittals if the page is closed | Yes | Shown in the list with Send now or Undo. Nothing auto-sends after the page closes. |

Needs before it works live: IT approves the Mail.Send API permission in the SharePoint admin centre. Until then the app shows the send as an error and records nothing as sent.
