# Security Scope: Document Management System

Status: scope only. No code yet. Date: 2026-11-05.

Target: a server or workstation joined to a Windows domain. Users sign in with domain identity. Files live in SharePoint. Metadata lives in SQL Server.

Important: the browser prototypes in this project (register, import, onboarding) are not secure. They hold data in browser storage and let any user act as any other user. Do not run them on a domain machine. Do not load real documents into them.

## 1. Assets

| Asset | Why it matters |
|---|---|
| Engineering documents (P&IDs, specs, permits) | Confidential. Loss or tampering affects safety and contracts. |
| Audit log | Evidence. Must not be altered or deleted. |
| Document metadata | Reveals projects, owners and plant design. |
| Service account credentials | Give access to SharePoint for all users. |
| Graph access tokens | Act as a user on SharePoint. |
| Domain trust | A compromise here can reach other domain systems. |
| Backups | Hold everything above in one place. |

## 2. Trust boundaries

1. Browser to web app (HTTPS, untrusted user input).
2. Web app to SQL Server (service identity, least privilege).
3. Web app to SharePoint / Graph (delegated user token, or app token for background jobs).
4. Web app to Active Directory (group lookups, Kerberos).
5. Admin workstation to server (RDP / management).

## 3. Threats and controls

Severity: Critical, High, Medium, Low. "Gap" means not yet designed or built.

### 3.1 Identity and access

| # | Threat | Sev | Control | Status |
|---|---|---|---|---|
| A1 | Any user acts as another user (demo "Signed in as") | Critical | Identity from domain (Kerberos or OIDC). Never from request body or client settings. | Gap |
| A2 | Access to documents across projects (IDOR) | Critical | Every query filtered by project membership. Check on every object ID. | Gap |
| A3 | Uploader checks or approves own work | High | Server enforces separation: uploader ≠ checker ≠ approver. Enforced in DB constraint too. | Gap (rules in demo only) |
| A4 | Privilege escalation through role edits | High | Role changes need admin role and are logged. Admins cannot approve own changes. | Gap |
| A5 | Stale access after user leaves | High | Access follows AD group membership. Disabled accounts lose access on next token refresh. Quarterly access review. | Gap |
| A6 | Service account used interactively | High | Service account cannot log on interactively. Deny logon rights set by GPO. | Gap |
| A7 | Shared or default admin password | Critical | No local accounts. No default credentials. Break-glass account stored offline, monitored. | Gap |

### 3.2 Web application

| # | Threat | Sev | Control | Status |
|---|---|---|---|---|
| W1 | SQL injection | Critical | Parameterised queries only. ORM or stored procedures. No string-built SQL. | Gap |
| W2 | Cross-site scripting (document titles, comments, summaries) | High | Output encoding by default. Strict CSP, no inline scripts. | Gap |
| W3 | Cross-site request forgery | High | Anti-forgery tokens on all writes. SameSite cookies. | Gap |
| W4 | Path or filename injection (`../`, reserved names, `DELETED_` abuse) | High | Filenames sanitised. Storage uses GUIDs. Names are display only. | Gap (rename rules in demo only) |
| W5 | CSV formula injection on export (`=HYPERLINK(...)`) | Medium | Prefix cells starting with `= + - @` with `'`. Export as XLSX text cells. | Gap |
| W6 | Mass assignment (client sets `deleted`, `status`, `checker`) | High | Explicit DTOs. Server sets status and workflow fields. | Gap |
| W7 | Missing rate limits (login, search, import) | Medium | Per-user rate limits. Import job concurrency limit. | Gap |
| W8 | Verbose errors leak stack traces or SQL | Medium | Generic error pages. Details to log only. | Gap |
| W9 | Missing security headers | Low | HSTS, CSP, X-Content-Type-Options, frame-ancestors none, Referrer-Policy. | Gap |
| W10 | Clickjacking | Low | frame-ancestors none. | Gap |
| W11 | Open redirect on sign-in return URL | Medium | Allow-list of return paths. | Gap |
| W12 | Session fixation or long sessions | Medium | Regenerate session on sign-in. Idle timeout 15 min. Absolute timeout 8 h. | Gap |

### 3.3 File upload and storage

| # | Threat | Sev | Control | Status |
|---|---|---|---|---|
| F1 | Malware in uploaded file | Critical | Antivirus scan (e.g. Defender for Endpoint or ICAP) before a revision is visible. Quarantine on hit. | Gap |
| F2 | Disguised file type (`.exe` renamed `.pdf`) | High | Magic-byte check against extension. Allow-list. Never execute or render server-side. | Gap |
| F3 | Zip bombs and nested archives | High | Do not unpack. Size and entry-count limits. Block or scan archives separately. | Gap |
| F4 | Oversized uploads exhaust disk | Medium | Size limit (50 MB per file, as set). Quota per project. | Gap |
| F5 | Files served with unsafe type or inline | High | Content-Disposition attachment. Correct MIME. No serving from app origin unless needed. | Gap |
| F6 | Integrity: file changed after approval | High | SHA-256 stored at upload. Checked on download and on schedule. Mismatch raises an alert. | Gap |
| F7 | Renaming or deleting in SharePoint outside the app | High | SharePoint permissions restrict direct edit. App detects drift in scheduled sync. | Gap |

### 3.4 SharePoint and Microsoft Graph

| # | Threat | Sev | Control | Status |
|---|---|---|---|---|
| S1 | Over-broad app permission (`Sites.FullControl.All`) | Critical | Use `Sites.Selected` for one site or library. Grant only what is needed. | Gap |
| S2 | Client secret leaked | Critical | Certificate auth, not secret. Certificate private key in machine store or HSM, non-exportable. | Gap |
| S3 | Delegated token stored or logged | High | Tokens in memory only. Never logged. Short lifetime. | Gap |
| S4 | App acts with user rights on the wrong user's behalf | High | On-behalf-of flow per request. No token cache shared across users. | Gap |
| S5 | Real delete by the app | Critical | App grants exclude delete where possible. App code only renames. Hard delete is an admin-only, out-of-band process. | Gap (rule in DECISIONS.md) |
| S6 | Rename collisions or lost file | Medium | Check target name before rename. Rename is logged both ways. | Gap |
| S7 | Throttling or partial failure during bulk operations | Medium | Retry with back-off. Idempotent job steps. | Gap |

### 3.5 Audit and integrity

| # | Threat | Sev | Control | Status |
|---|---|---|---|---|
| L1 | Audit log edited or deleted | Critical | Append-only table. DB role has INSERT and SELECT only. Trigger blocks UPDATE and DELETE. Hash chain per row. Copy shipped to a separate write-once store. | Gap (array in demo) |
| L2 | Audit log missing events | High | Log in the same transaction as the change. Log reads and downloads too. | Gap |
| L3 | Logs hold secrets or personal data | High | No tokens, passwords or file contents in logs. Mask personal data where possible. | Gap |
| L4 | Clock skew breaks audit order | Medium | Domain time sync. Store UTC. Use DB server time for log rows. | Gap |
| L5 | Auditor cannot prove completeness | Medium | Daily hash of log chain, stored outside the app. | Gap |

### 3.6 Data protection

| # | Threat | Sev | Control | Status |
|---|---|---|---|---|
| D1 | Data at rest readable from stolen disk | High | BitLocker on server. SQL TDE. Backups encrypted. | Gap |
| D2 | Data in transit intercepted | High | TLS 1.2 minimum, internal CA certificate trusted by domain. No plain HTTP. | Gap |
| D3 | Backups restored to wrong place or exposed | High | Backup encryption. Restore test each quarter. Backup admin separate from app admin. | Gap |
| D4 | Purge deletes under legal hold | High | Legal hold flag blocks purge. Purge job checks hold before every row. Logged. | Gap (hold not built) |
| D5 | Retention too short or too long | Medium | Confirmed retention schedule from client contract and QA. | Open decision |
| D6 | Data sent to third parties (AV cloud scan, telemetry) | Medium | Confirm scan service location. Disable telemetry. | Gap |

### 3.7 Infrastructure and host

| # | Threat | Sev | Control | Status |
|---|---|---|---|---|
| H1 | Server compromise pivots into domain | Critical | Dedicated server in its own OU. No domain admin rights for app. Host firewall: only SharePoint, SQL, AD, AV. Patched monthly. | Gap |
| H2 | Unconstrained Kerberos delegation | Critical | Never enable. Use constrained delegation only if needed, to named SPNs. | Gap |
| H3 | Local admin on server for all developers | High | Named admin group. Just-in-time admin. Session recording on admin access. | Gap |
| H4 | Inbound exposure to internet | Critical | No public endpoint. Reverse proxy inside network only. Remote access via VPN with MFA. | Gap |
| H5 | Unpatched runtime or OS | High | Patch cadence. SBOM for app. Dependency scanning on each build. | Gap |
| H6 | Antivirus or EDR blocks or misses app | Medium | Agree exclusions with security team, by path and process, not by disabling. | Gap |
| H7 | Event logs not forwarded | High | Forward Windows, IIS and app logs to SIEM. | Gap |
| H8 | Debug mode or dev tools in production | Medium | Production config. Debug off. Swagger off. | Gap |

### 3.8 Supply chain and build

| # | Threat | Sev | Control | Status |
|---|---|---|---|---|
| C1 | Malicious or vulnerable package | High | Lockfile. Pinned versions. Vulnerability scan in CI. Private package feed where possible. | Gap |
| C2 | Unsigned binaries deployed | High | Code signing for executables. Signed packages. | Gap |
| C3 | Secrets committed to repo | Critical | Secret scanning in CI. Pre-commit hook. Repo history check before first push. | Gap |
| C4 | Build server compromised | High | Separate build agent. Least privilege. | Gap |

### 3.9 Operations

| # | Threat | Sev | Control | Status |
|---|---|---|---|---|
| O1 | No incident plan | High | Runbook: disable account, revoke tokens, rotate certs, restore from backup. | Gap |
| O2 | Key or certificate expiry outage | Medium | Expiry monitoring. Calendar. | Gap |
| O3 | Insider misuse (mass download, mass delete) | High | Alerts on bulk download and bulk delete. Threshold per user per day. | Gap |
| O4 | Unclear ownership of the app | Medium | Named owner, named service account owner, change control. | Gap |

## 4. Required decisions before build

1. Identity: on-premises AD only, or Entra ID (hybrid)?
2. SharePoint: Online (Microsoft 365) or Server (on-premises)?
3. Hosting: which server, which OU, who administers it?
4. Malware scanner: which product, and is cloud scanning allowed?
5. Retention: confirmed periods for deleted items and logs.
6. Legal hold: who places and releases holds?
7. Data classification: are any documents restricted beyond project level?
8. Backup target and retention for backups.
9. Who signs off the security design?

## 5. Minimum bar before any real data

All of these must be true before real documents go in:

- [ ] Identity from domain. No client-supplied identity.
- [ ] Project-level authorisation on every read and write.
- [ ] Parameterised SQL only. Output encoding. CSRF protection.
- [ ] Upload: allow-list, magic bytes, size limit, malware scan, hash.
- [ ] Audit log append-only, written in the same transaction.
- [ ] Soft delete only. Purge blocked by legal hold.
- [ ] SharePoint app permission limited to one library. Certificate auth.
- [ ] TLS internal certificate. No plain HTTP.
- [ ] Service account: no interactive logon, no domain admin.
- [ ] No inbound internet exposure.
- [ ] Penetration test of the running app, by someone other than the builder.
- [ ] Restore test from backup completed.
- [ ] Incident runbook written and walked through once.

## 6. Out of scope for this document

- Physical security of the server room.
- Staff vetting.
- Network segmentation design beyond the server's own firewall (owned by network team).
