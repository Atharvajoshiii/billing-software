-- Add supporting indexes for journal foreign keys flagged by Supabase advisors.
create index if not exists business_journal_counters_financial_year_idx
  on private.business_journal_counters (financial_year_id);
create index if not exists business_journal_entries_year_business_fk_idx
  on public.business_journal_entries (financial_year_id, business_id);
create index if not exists business_journal_entries_period_business_fk_idx
  on public.business_journal_entries (accounting_period_id, business_id);
create index if not exists business_journal_entries_year_fk_idx
  on public.business_journal_entries (financial_year_id);
create index if not exists business_journal_entries_period_fk_idx
  on public.business_journal_entries (accounting_period_id);
create index if not exists business_journal_entries_posted_by_fk_idx
  on public.business_journal_entries (posted_by);
create index if not exists business_journal_entries_reversal_of_fk_idx
  on public.business_journal_entries (reversal_of_entry_id, business_id);
create index if not exists business_journal_entries_reversed_by_fk_idx
  on public.business_journal_entries (reversed_by_entry_id, business_id);
create index if not exists business_journal_lines_account_business_fk_idx
  on public.business_journal_lines (account_id, business_id);
create index if not exists business_journal_lines_entry_business_fk_idx
  on public.business_journal_lines (journal_entry_id, business_id);
