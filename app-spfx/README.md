# Document Register: SharePoint web part (app-spfx)

A SharePoint Framework (SPFx 1.20) web part. Runs on a SharePoint Online page.
Sign-in is automatic through Windows. Data is in SharePoint lists and the "Register Files" library.

## What is here

- `src/domain/`: the business rules and numbering. Ported from `../app/src/rules.js`. Pure TypeScript.
- `src/services/register.ts`: all SharePoint reads and writes. Every write checks the rules first.
- `src/components/`: the screens (documents, document page, add document, activity).
- `src/webparts/documentRegister/`: the web part and its manifest. The site address is a web part setting.
- `provisioning/Provision-DocumentRegister.ps1`: creates the lists, library and groups on a site.
- `tests/`: rule tests. Run with `npm test` (Node 22 or later).

## Build

Needs **Node 20** for the SharePoint build (SPFx 1.20 does not run on Node 22). Use Node 20 for `build` and `package-solution`.

```
npm install
npm test                    # rule tests (Node 22 or later)
npx gulp bundle --ship      # Node 20
npx gulp package-solution --ship   # Node 20
```

The package is written to `sharepoint/solution/document-register.sppkg`.

## Deploy (one time per site)

1. **Test site first.** Ask IT for a test site (see `../SHAREPOINT_PLAN.md`).
2. **Provision lists.** Run `provisioning/Provision-DocumentRegister.ps1 -SiteUrl <your test site>`.
3. **Add people** to the groups "Register Members" and "Register Records Lead".
4. **Upload the package.** Tenant app catalog → Apps for SharePoint → upload `document-register.sppkg`. Trust it. Tenant admin may need to approve it.
5. **Add the web part.** Edit a page on the test site → add "Document Register" → set "SharePoint site address" to the test site.

## Not yet tested against a real tenant

The build, the rule tests and the type check pass here. The live SharePoint calls, the provisioning script
and the deploy steps have not been run against a real tenant. Expect a short fix cycle on the first real run.
