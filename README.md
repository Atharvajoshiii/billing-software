# Ledgerwise

A web-first billing workspace for Indian small businesses, built with Next.js, shadcn/ui, and Supabase.

## Start locally

1. Copy `.env.example` to `.env.local` and add your Supabase project URL and publishable key.
2. Run `npm install`.
3. Run `npm run dev` and open http://localhost:3000.

The database schema has been applied to the Supabase project `billing-software` using the Supabase plugin. The browser uses only the publishable key; row-level security is enabled on business data.

Foundation work in progress includes business roles and invitations, audit history, retry-safe transaction RPCs, financial years and locked periods, opening balances, GST registration setup, and server-paged record lists. Review [foundation readiness](docs/operations/foundation-readiness.md) before using this as a production accounting system. The checkout does not yet have the source for every applied database migration.

## First version

- Email/password sign-up and sign-in, plus initial business setup.
- Product catalog, customer/supplier contacts, purchases, expenses, GST summaries, and CSV exports.
- Sales invoices with automatic numbering, per-product GST calculations, stock deduction, print layout, and payment recording.
- Purchase bills increase inventory; customer receipts update invoice balances.

GST reporting is a preview only. GST return filing, IRP e-invoice registration, e-way bills, and legal validation are not connected in this version.

## Operations

- Database migration history and recovery caveats: [Supabase README](supabase/README.md).
- Backup configuration and restore procedure: [backup runbook](docs/operations/backup-and-restore.md).
- The daily encrypted backup workflow requires GitHub repository secrets `SUPABASE_DB_URL` and `BACKUP_AGE_RECIPIENT`, plus a restore drill before launch.
