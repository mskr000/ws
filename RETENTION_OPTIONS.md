# Retention and legal hold: options

Date: 2026-11-06. Status: options for decision. Not legal advice. Your legal or compliance owner must confirm the period and the hold rules.

## What the words mean here

- **Retention:** how long a document must be kept before it may be removed.
- **Legal hold:** a freeze on one document (or project) while a dispute, audit or claim is open. Nothing may be removed or renamed until the hold is released.

## Options

| | Option | How it works | Pros | Cons |
|---|---|---|---|---|
| A | App rules only (built) | Retention counts from the last activity. Legal hold set and released by the Records Lead, with a reason, logged. The app blocks removal. | Works now. No licence. Visible in the app. | Anyone with direct SharePoint access can still delete. Not enforced by SharePoint. |
| B | A + SharePoint retention label (Purview) | IT applies a retention label to Register Files and the lists (for example 7 years). Labelled items cannot be deleted before the label expires. | Enforced by Microsoft 365, not only by the app. Matches the IT request item 6. | Needs IT and a Microsoft 365 plan that includes Purview retention. |
| C | B + eDiscovery hold (Purview) | For a dispute, a hold is placed on a site or a person's content in Purview. Preserved even if deleted. | Strongest. Court-grade preservation. | Needs eDiscovery licence and a named case owner. More admin. |

## My recommendation

Use **B** now and keep **A** as the day-to-day control.

- A gives the Records Lead a visible hold and reason in the app, which SharePoint cannot do.
- B is the enforcement layer. Ask IT for it in the same request as the site and library.
- Use **C** only when a real dispute appears. Do not set it up in advance.

## Decisions needed from you

1. **Retention period.** Built default: 7 years after the last activity. Confirm or change. Some rules differ by document type (for example, safety records or tax records).
2. **Start point.** Built: last activity (latest revision, upload or certificate). Alternative: date of removal, or date of project close-out.
3. **Who places and releases holds.** Built: anyone with the remove permission (Records Lead by default). Alternative: admin only, or two people.
4. **Hold scope.** Built: one document. Alternative: whole project, which needs a project hold.
5. **Purview.** Do you have a Microsoft 365 plan that includes retention labels? Check with IT (see below).

## How to check the Microsoft 365 plan (you can do this)

- Admin centre > Billing > Your products: look for Microsoft 365 E3, E5, or Business Premium. E5 or E3 include retention labels. Business Basic or Standard do not.
- Power Automate: admin centre > Billing > Licenses, or go to make.powerautomate.com and open Solutions or My flows. If Power Automate is listed as included, the flows in AUTOMATION_PARKED.md can be built.

I cannot see your tenant from here. Please send me what the admin centre shows and I will update the decision.
