# Data Classification (HOD Command Centre)

This document is a lightweight guide for what data is stored where, who can access it, and what should be treated as sensitive.

## Classifications

- **Public**: Safe to be readable by anyone without authentication. (Target: none in Firestore.)
- **Internal**: Readable by authenticated/authorized users, but not intended for wide sharing.
- **Restricted**: Contains personal data, operational security data, or admin-only diagnostics; must be admin-only readable.

## Firestore namespaces (current)

- `roles/{uid}` (**Restricted**)
  - Purpose: RBAC authorization.
  - Access: user can read their own role doc; admins can list; only superadmins can write (enforced by rules).

- `whitelistedUsers/{emailLower}` (**Restricted**)
  - Purpose: legacy invite/bootstrap list.
  - Access: superadmin-only.
  - Notes: doc IDs are emails (PII) but locked down by rules.

- `artifacts/{appId}/users/{uid}/**` (**Restricted**)
  - Purpose: user-owned working data (tasks, staff, strategy, schedule, etc.).
  - Access: only the owning `uid` (enforced by rules).

- `artifacts/{appId}/telemetry/{docId}` (**Restricted**)
  - Purpose: operational analytics.
  - Access: client-writable by authorized roles; admin-readable.
  - Notes: should not store raw emails; events include `sessionId` and a TTL-friendly `expiresAt` field.

- `artifacts/{appId}/feedback/{docId}` (**Restricted**)
  - Purpose: user feedback + crash reports.
  - Access: client-writable by authorized roles; admin-readable.
  - Notes: crash reports intentionally avoid storing raw email; include `sessionId` and `expiresAt`.

- `artifacts/{appId}/aiQuota/{uid}/**` (**Restricted**)
  - Purpose: server-maintained AI usage/rate counters.
  - Access: admins can read; no client writes.

## PII rules of thumb

- Do not write raw email addresses into telemetry/feedback.
- Prefer stable, non-human identifiers (`uid`) plus a short-lived `sessionId` for correlation.
- Keep any sensitive/admin datasets under admin-readable-only collections and enforce via Firestore rules.
