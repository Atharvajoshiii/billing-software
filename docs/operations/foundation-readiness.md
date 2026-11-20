# Foundation readiness

Reviewed against the live `billing-software` Supabase project on 2026-11-17.
The production database contains business records; database changes were
additive and preserved the existing rows.

## Implemented

- RLS is enabled on all 20 public application tables. Tenant-aware membership
  policies and cross-business foreign-key constraints protect business data.
- Membership roles include owner, admin, accountant, cashier, and stock staff.
  Database policies and RPC checks enforce sensitive actions. The UI supports
  multiple workspaces, invites, role changes, removals, and invite revocation.
- Invitation records, expiry handling, acceptance checks, and the
  `invite-business-member` Edge Function support email-based onboarding.
- Invoice, purchase, payment, inventory adjustment, expense, and opening-balance
  write paths use transactional database functions with idempotency keys.
- Financial years, monthly accounting periods, period locking, a starter chart
  of accounts, and guided opening-balance posting are available. Posting checks
  date coverage, account ownership, two-decimal precision, and debit/credit
  equality. Posted batches are immutable.
- GST registrations can be managed and one active registration selected as
  primary. GST reporting remains a preview and does not file returns.
- Database triggers write transaction changes to `audit_events`; the UI exposes
  recent events. Audit history is not backfilled from before the triggers were
  installed.
- Invoice, product, contact, purchase, expense, and audit lists now request
  server-side search results in 50-row pages with exact result counts. Existing
  dashboard/report calculations still use capped client-loaded data and need
  database-side aggregation before large-scale use.
- An encrypted database export script and restore runbook are present. A daily
  GitHub Actions workflow is configured; it requires repository secrets and a
  successful restore drill before backup operations are considered verified.

## Still required before production launch

| Area | Remaining work |
| --- | --- |
| Reproducible migrations | The live project records 34 migrations. This checkout is missing source for 24 applied migrations, including the original 12 and several foundation migrations. Do not reset or replay production from this repository until a complete schema/migration baseline is recovered and validated on a disposable project. |
| Reporting at scale | Move dashboard, GST, receivables, and other report aggregates into database queries/RPCs; remove capped client-side calculations. |
| Audit completeness | Confirm all business-critical tables and immutable document snapshots are covered; design correction, credit-note, cancellation, and reversal flows for issued records. Existing historical changes cannot be reconstructed from the new audit triggers. |
| Backup operations | Configure `SUPABASE_DB_URL` and `BACKUP_AGE_RECIPIENT` in GitHub Actions, confirm encrypted artifacts are retained, add a durable off-site copy policy, and complete a restore drill in a disposable Supabase project. Storage objects, Auth configuration, SMTP, and provider settings need separate recovery procedures. |
| Auth hardening | Supabase's security advisor reports leaked-password protection is disabled. Enable it in Authentication password security settings in the Dashboard. |
| Invitation delivery | Set the production redirect URL in Supabase Auth and verify SMTP/email delivery. |
| End-to-end validation | Exercise role boundaries, retries, numbering, accounting-period locks, opening-balance posting, and backup restoration in a non-production environment before customer data is onboarded. |

## Supabase advisor status

The latest review found the leaked-password protection warning. Unused indexes
are informational at the current low workload. Review advisors again after
realistic workload and data-volume growth.

See [database functions](database-functions.md), the
[backup and restore runbook](backup-and-restore.md), and
[migration recovery notes](../../supabase/README.md).
