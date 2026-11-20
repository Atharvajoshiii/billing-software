# Current Ledgerwise platform audit

## What is implemented today

### Takeaway
Ledgerwise is a working first-slice billing workspace with Supabase Auth and browser-side data access, centered on one business workspace. It supports basic product/contact masters, sales invoices, purchases, stock adjustments, expense capture, receipts/payments, printable invoices, dashboard summaries and CSV exports. This is materially smaller than a full accounting system or GST compliance platform.

### Cited Findings
- The repository has one app route, `src/app/page.tsx`, implemented as a client component; navigation between Dashboard, Invoices, Products, Customers, Purchases, Expenses, GST reports and Settings is React state rather than separate routes. [Main app](../../src/app/page.tsx)
- Sign-up/sign-in use Supabase email/password authentication. First-time users can create a business through `create_business`; the workspace then loads the first membership returned from `business_members`. [Auth/workspace implementation](../../src/app/page.tsx); [Supabase client](../../src/lib/supabase.ts)
- Product records include name, SKU, HSN/SAC, unit, sale/purchase prices, one GST rate, stock quantity, stock tracking and active status. Contacts include type, GSTIN, phone/email/address, state code and opening balance. The UI supports add/edit for both and stock adjustments for tracked products. [Product and contact forms](../../src/app/page.tsx)
- Sales invoices use product lines with quantity, editable unit price and discount percent, product GST rate, customer, dates and notes. The client sends invoice creation to `create_sales_invoice`; the list supports printing, partial/full customer payments, outstanding balance and overdue status. The README states invoice numbering and stock deduction are handled. [Invoice handlers/forms](../../src/app/page.tsx); [README scope](../../README.md)
- Purchase entry supports supplier, supplier invoice number, bill date, product lines, quantity and rate; `create_purchase` is expected to update stock. Supplier payment is recorded through `record_purchase_payment`. Inventory adjustment uses `adjust_inventory`. [Purchase/payment handlers](../../src/app/page.tsx)
- Expenses can be inserted directly into Supabase with category, amount, GST amount, date and payment method. The dashboard shows sales, receipts, current receivables, GST on sales, purchases, expenses, overdue invoices and low-stock counts; the GST screen groups invoice lines by the five offered GST-rate options. [Expense/dashboard/report implementation](../../src/app/page.tsx)
- The app can export CSVs for invoices, products, contacts, purchases, expenses and a selected dashboard period; it creates a simple printable invoice document and invokes browser print. [Export and print functions](../../src/app/page.tsx)
- The README says the Supabase schema is deployed to the `billing-software` project, business data has row-level security, and the browser uses a publishable key. It also explicitly says GST reporting is preview-only and there is no GST return filing, IRP registration, e-way bills or legal validation. [README](../../README.md)

### Inferences
- The product is best described today as billing + basic inventory and receivables/payables capture, not accounting: invoices, purchases, expenses and payment events exist, but a user-facing accounting ledger or financial statements are not implemented in the repository.
- Data integrity for core sales and purchase workflows depends on deployed Supabase RPC implementations. The client invokes functions but their definitions, migrations, constraints, authorization logic and transactional guarantees are absent from this repository, so they cannot be audited here.

### Gaps
- Deployed Supabase schema, RPC bodies, RLS policies, backups, monitoring and production behavior were not available in repository files. The README assertion is not independently verified by this code audit.

## Architecture and operational constraints

### Takeaway
The current structure is optimized for a prototype: most feature logic and UI live in one large client-side page, data is loaded directly into browser state, and there is no checked-in schema/migration or test suite. It can serve as a useful design prototype, but it needs a deliberate platform foundation before adding many modules or claiming reliability for business books.

### Cited Findings
- `loadData` fetches products, parties, invoices, purchases, expenses and payments into the browser in parallel; invoices, purchases, expenses and payments each have a 1,000-row limit. Dashboard totals and reports are then calculated in client memory. [Data loading and calculations](../../src/app/page.tsx)
- Supabase browser client creation requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; CRUD for products, contacts, expenses and business settings is performed directly from the client, while key transactional operations use RPC calls. [Supabase client](../../src/lib/supabase.ts); [handlers](../../src/app/page.tsx)
- Workspace selection calls `business_members` with `.limit(1).maybeSingle()` and sets a single `business` object. The UI does not expose a business switcher or multi-company workspace management. [Workspace loading](../../src/app/page.tsx)
- The package scripts include dev, build, start and lint; no test script or test files appear in the checked-in application tree. [package.json](../../package.json); [file inventory](../../)
- `src/app/page.tsx` contains app state, data access, calculations, forms, dashboard, lists, marketing/auth/setup screens and helper components in one file; there is no server route/API, service layer, migration directory or domain-module structure in the repository file inventory. [Main app](../../src/app/page.tsx); [repository files](../../)
- The visible search state filters products, contacts and invoices, but purchase and expense tables render their full arrays; purchases and expenses therefore do not currently have functioning list filtering despite sharing the toolbar UI. [Search derivation and list rendering](../../src/app/page.tsx)

### Inferences
- Client-side fetching, fixed 1,000-row limits and browser-computed reports will become a scale and correctness constraint as a retailer accumulates years of transactions. Server-side pagination, aggregation and permission-aware query boundaries are needed before serving high-volume or multi-branch organizations.
- Direct browser CRUD is viable when protected correctly by RLS, but must be paired with database-level validation, immutable issued-document snapshots, unique numbering guarantees, idempotent writes and audit events. These requirements are especially important for accounting and tax documents.
- The current single-business membership assumption and absence of roles in the UI mean a team, accountant/CA, cashier, manager or multi-GSTIN product cannot be considered implemented even though the database may contain membership records.

### Gaps
- No checked-in migrations, RLS policies, SQL functions, schema typings, API/service tests or automated accounting/GST calculation tests were found. The actual deployed backend may contain them, but the repo offers no repeatable review or deployment source of truth.
- The code audit did not run the app or tests; it is a static inspection of the repository.

## Gaps against an advanced billing and accounting SaaS

### Takeaway
The largest gap is not a single advanced feature: it is the missing transaction/accounting/compliance foundation beneath the current forms. Build a dependable transaction lifecycle and double-entry ledger first; then expand into GST preparation/integration and vertical-specific inventory. Larger businesses additionally require organizational controls, auditability, period close and scale.

### Cited Findings
- The product research report describes a connected lifecycle including organization/registrations, users/roles, masters, sales and purchase documents, stock movements, payments, notes/returns, reports and integrations. This is proposed target scope, not a description of current code. [Product landscape report](../India%20billing%20software%20landscape.md)
- The current app’s document types are sales invoice, purchase bill, payment, expense and stock adjustment; no quote/order/challan/return/credit-note/debit-note document forms or workflows appear in the route or modal types. [Modal and section types/forms](../../src/app/page.tsx)
- GST report UI is a summary preview by rate and explicitly labels portal filing/IRN connection as incomplete. Product setup offers a fixed set of rate choices and a free-form HSN/SAC field. [GST report and checklist](../../src/app/page.tsx)
- The README identifies GST portal return filing, IRP e-invoice registration, e-way bills and legal validation as absent. [README](../../README.md)

### Inferences
- **Accounting core:** add a chart of accounts, double-entry journal posting, general ledger, trial balance, profit and loss, balance sheet, cash/bank book, receivables/payables ledgers, opening balances, journal vouchers, bank reconciliation, period lock/reopen controls and audit trail. Ensure every invoice, receipt, supplier bill, payment, expense, stock movement, return and note posts balanced, traceable entries.
- **Document lifecycle:** add estimates/quotations, orders, delivery challans, sales and purchase returns, credit/debit notes, cancellations/voids with reasons, refunds, payment allocation and customer/vendor statements. Preserve original issued snapshots and link corrections to source documents; never silently rewrite posted records.
- **Inventory depth:** add warehouses/godowns, transfers, purchase receiving, stock ledger, reservations, reorder, valuation/costing, batch/expiry and serial/IMEI where target verticals need them; support barcode/keyboard counter entry and thermal printing.
- **GST engine:** store GST registrations and effective dates, registration type, seller/buyer GST status, place of supply, ship-to/bill-to, tax category and rate provenance, cess, discounts, reverse charge, export/SEZ, composition/bill-of-supply cases, amendments and return-relevant classifications. Calculate tax components from transaction facts and a versioned rules/master layer rather than assuming a product percentage alone is sufficient.
- **GST operations:** implement reviewable GSTR-1/GSTR-3B preparation and exports, purchase/input-tax-credit reconciliation with portal data, exception queues, GSTN authorization/filing if commercially and legally available, then resilient IRP and e-way-bill integrations with external status, retries, duplicate protection, cancellation/replacement and request/response audit history.
- **SaaS/enterprise foundations:** add organizations with multiple GST registrations, branches, users and roles/permissions, invitations, accountant access, activity/audit history, notifications, backups/export/restore, data import/migration, onboarding, subscription/billing/entitlements, support tooling, observability and security operations. Add APIs/integrations and organization-level reports only as the chosen customer segment justifies them.
- **Trust and operations:** specify database transactions and unique invoice numbering by GST registration/financial year; protect posted records from destructive edits; validate GSTIN/state/HSN context; reconcile derived balances against ledger source data; support import/export and recovery. Work with an Indian GST practitioner before production compliance claims.

### Gaps
- Exact ordering depends on target customer. A counter-first retailer needs speed, offline/print/scanner workflows and stock; an accounting-first wholesaler needs vouchers, ledger depth, credit controls, reconciliation and multi-location stock; a service firm needs estimates, recurring billing and time/project work. One release cannot optimize all three equally.
- This audit is an implementation inventory and roadmap inference, not legal advice, proof of deployed-backend security, or evidence that any unlisted capability is impossible in the external Supabase project.
