# Database functions

All public RPC wrappers use an empty `search_path`. Internal authorization and
state-changing helpers are in the non-exposed `private` schema, use an empty
`search_path`, and check the signed-in user's current business membership.

## Business and team access

| RPC | Purpose |
| --- | --- |
| `create_business(text,text,text)` | Creates a business and its owner membership. |
| `create_business_invitation(uuid,text,text)` | Creates an email invitation for an allowed role; owner/admin permission is checked in the private implementation. |
| `accept_business_invitation(uuid)` | Accepts an invitation only for a signed-in, confirmed user whose email matches. |
| `get_business_members(uuid)` | Returns a workspace roster with user IDs, email addresses, display names, roles, and join dates; the private implementation checks current business membership. |

The `invite-business-member` Edge Function authenticates the caller, invokes
the database invitation RPC with that user's JWT, and asks Supabase Auth to send
the invite email. The service-role key is used only inside the Edge Function.
The invite link returns to `/?invitation_id=...`; the app then calls the
acceptance RPC.

## Business transactions

Legacy signatures remain available for compatibility. New app flows should
call the overloads that include `p_idempotency_key uuid`.

| RPC | Purpose / protection |
| --- | --- |
| `create_sales_invoice(...,jsonb,uuid)` | Creates an invoice, its lines, number, stock movements, and document snapshots. Role checks, validation, counters, and writes are atomic. |
| `create_purchase(...,jsonb,uuid)` | Creates a supplier bill, lines, and stock movements atomically. |
| `adjust_inventory(...,text,uuid)` | Applies a stock correction and records its movement atomically. |
| `record_payment(...,date,uuid)` | Records a customer receipt and updates invoice balance/status under a row lock. |
| `record_purchase_payment(...,date,uuid)` | Records a supplier payment and updates purchase balance/status under a row lock. |
| `create_expense(...,uuid)` | Validates and creates an expense with a retry-safe idempotency key. Direct expense inserts are revoked from authenticated clients. |
| `post_opening_balance(uuid)` | Posts only a non-empty opening-balance batch with equal debits and credits; posted batches and lines are immutable. |
| `set_accounting_period_lock(uuid,boolean)` | Locks a period for finance roles; only owner/admin can reopen it. |
| `post_journal_entry(uuid,date,text,jsonb,uuid)` | Posts a finance-role manual voucher only when it has at least two valid lines, uses active accounts in the same business, falls in an open year and period, and debits equal credits. The request is idempotent. |
| `reverse_journal_entry(uuid,date,text,uuid)` | Creates a new linked voucher with the original debit/credit sides swapped, and marks the original as reversed. The reversal date must be in an open period; posted lines are never edited. |

Idempotency uses a SHA-256 hash of the normalized JSONB input and a unique
business/user/operation/key tuple. Same input returns the stored resource ID.
Changing the payload while reusing a key returns an error. The payload itself is
not stored in the private idempotency table.

## Triggers and data controls

- `ledgerwise_capture_audit_event()` writes actor, operation, record key, and
  before/after JSON into `audit_events` in the same transaction as the change.
- Financial-year inserts generate monthly accounting periods. Overlapping
  financial years are rejected.
- Invoice, purchase, payment, and expense dates must fall in a configured open
  period. Closed periods reject inserts and date edits.
- Direct product updates cannot change `stock_on_hand`; stock changes use the
  inventory RPCs and append-only movement history.
- Payment/document constraints enforce one and only one invoice or purchase
  target, with tenant-consistent party links.
- Journal vouchers are append-only for authenticated users. The posting and
  reversal RPCs own all journal writes; audit triggers capture each header and
  line in the same transaction. Journal numbers are serialized per business
  and financial year.

## Operational limits

Audit history starts at trigger installation; it cannot reconstruct historical
changes. Opening-balance posting and manual journal vouchers are implemented.
Invoice, purchase, payment, expense, inventory, and opening-balance workflows
are not yet connected to automatic journal posting; that is the next accounting
integration step. Dashboard and GST report aggregates still use client-loaded
records and are not ready for large datasets. A complete correction workflow
for issued invoices is also missing. Source for some applied migrations is
missing; see `supabase/README.md` before rebuilding or replaying the schema.
