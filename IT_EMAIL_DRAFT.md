**Subject:** Document Register: what we built and what we need from IT

Hi [IT contact],

We have built a simple tool to keep track of our project documents. It is a web page inside our SharePoint site. Before we set it up on the company site, we need a few things from you.

**What it does**
- Keeps one list of project documents, drawings, reports and certificates.
- Keeps every version of a document. Nothing is overwritten.
- Keeps a record of who did what, and when.
- Lets a named person approve a document before it is final.
- Never deletes anything. A removed item is marked as removed and can be restored.

**Where it lives**
- Inside our own Microsoft 365 / SharePoint. Nothing is sent outside the company.
- No separate server. No new software to install on the PCs.
- People sign in with their work account. No extra passwords.

**What we need from IT (one request)**
1. A test team site called "Document Register". A second site for live use later.
2. Permission to upload one small app file to the company app catalog, and for it to be approved.
3. Two groups on the site: "Register Members" (add and update) and "Register Records Lead" (full control).
4. One document library called "Register Files", with version history switched on.
5. Confirmation that work PCs sign in with the company account, so sign-in is automatic in the browser.
6. Optional, later: a retention label for 7 years on the files and the audit list. (See the questions below.)

**Email sending (new, please read)**
- The register can send transmittal emails. Each email goes from the signed-in person's own work mailbox, not from a shared account.
- To allow this, the app asks for one permission: "Mail.Send" for Microsoft Graph, on behalf of the signed-in user. It can send mail only as that person. It cannot read anyone's mail.
- IT must approve this permission once in the SharePoint admin centre, under API access. It is a standard request. It is not an app registration.
- Each sent email is recorded in the register: who sent it, to whom, and when. A 60-second undo is available.

**What we do not need**
- No new app registration.
- No outside access to our data.

**Questions for you**
1. Do we have Power Automate included in our Microsoft 365 plan? We would use it later for reminders and alerts.
2. Which Microsoft 365 plan do we have? Does it include retention labels?
3. Who approves an app file for the app catalog?
4. Is a test site allowed before the live site is created?
5. Can you approve the "Mail.Send" API permission in the SharePoint admin centre (API access), for the Document Register package only?
6. Do we need a mail-retention or compliance check for emails sent by the register?

We can walk you through the demo in 15 minutes. The demo file is attached.

Thank you,

[Your name]
[Your role]
