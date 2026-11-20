# Supabase schema and migrations

This project points to the existing production Supabase project
`billing-software`. Never reset or replay its database from this checkout until
the missing migration sources listed below have been recovered.

## Live migration history

The live database currently records 36 migrations:

```text
20261019083444 initial_billing_platform                 [source missing]
20261019083601 purchases_and_business_setup             [source missing]
20261019083801 qualify_business_isolation_policies       [source missing]
20261019084636 tenant_integrity_constraints              [source missing]
20261019084655 secure_document_line_tenant_policies      [source missing]
20261019084839 index_business_workflows_and_policies     [source missing]
20261019085212 supplier_payment_tracking                 [source missing]
20261019085245 record_opening_inventory_movements        [source missing]
20261019085346 inventory_adjustments                     [source missing]
20261019085528 snapshot_invoice_parties_at_issue          [source missing]
20261019091648 fix_business_members_rls_recursion         [source missing]
20261019091725 isolate_business_creation_definer          [source missing]
20261117105823 financial_years_and_gst_registrations      [source present]
20261117105829 audit_history                              [source present]
20261117105830 payment_integrity_and_rpc_grants           [source present]
20261117105836 foreign_key_supporting_indexes              [source present]
20261117111901 foundation_access_controls                  [source missing]
20261117112046 foundation_stock_movement_guard             [source missing]
20261117112632 foundation_accounting_periods_opening_balances [source present]
20261117112809 foundation_transaction_idempotency         [source present]
20261117112903 foundation_accounting_controls_and_audit    [source missing]
20261117112921 foundation_accounting_cascade_guard_fix      [source missing]
20261117112950 foundation_accounting_fk_indexes            [source missing]
20261117113120 foundation_private_rpc_execute_grants       [source missing]
20261117113601 foundation_invitation_expiry_fix             [source missing]
20261117114250 foundation_period_date_coverage_guards       [source missing]
20261117114323 foundation_accounting_policy_cleanup         [source missing]
20261117114622 foundation_expense_idempotency               [source present]
20261117115128 foundation_team_invitation_revocation         [source missing]
20261117115342 foundation_atomic_opening_balance_entry       [source missing]
20261117115538 foundation_gst_registration_primary_rpc       [source missing]
20261117120015 foundation_opening_balance_precision          [source present]
20261117120918 foundation_expense_list_index                 [source present]
20261117121745 foundation_team_member_details                [source present]
20261118182240 accounting_journal_engine                    [source present]
20261118182721 accounting_journal_fk_indexes                [source present]
```

The source files that are present are under `migrations/`. The missing files
are **not** replaced with no-op migrations because that would falsely imply a
clean install can reproduce the live schema. Recover them from the original
working tree or a schema export, then test a clean bootstrap in a disposable
Supabase project before marking the schema reproducible.

## Workflow and safety

- Use the Supabase MCP plugin for production database changes and review the
  project advisors after schema changes.
- The Supabase CLI is not installed in this checkout. Do not guess CLI
  commands; install it and read `supabase --help` before using it.
- Use new timestamped migration files for future schema changes. Do not edit
  migrations already recorded as applied unless deliberately reconciling a
  historical source file.
- SQL Editor diagnostics in `sql/` are not migration files. Review each query
  before running it; never run preflight reports as if they were DDL.
- Keep business data, connection strings, service-role secrets, and backup
  archives out of the repository.

## Edge Functions

`functions/invite-business-member/index.ts` sends an Auth invitation after the
database has authorized and created the invitation record. It uses the caller's
JWT for the RPC and the server-side service-role key only for the Auth admin
operation. Keep JWT verification enabled. Configure the production app URL in
Supabase Auth's allowed redirect URLs and verify the project's email/SMTP
delivery before using team invitations.
