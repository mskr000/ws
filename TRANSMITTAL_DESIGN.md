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
