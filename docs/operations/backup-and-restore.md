# Database backup and restore runbook

## Current project status

The repository includes a daily GitHub Actions workflow that creates an
encrypted logical export and stores it as a GitHub Actions artifact for 30
days. The workflow is not active until the repository is pushed to GitHub and
the `SUPABASE_DB_URL` and `BACKUP_AGE_RECIPIENT` repository secrets are set.
Artifacts are a short-retention recovery copy, not a durable off-site backup
policy. Configure a separate access-controlled destination for long-term
retention. Do not treat this Free project as having managed daily backups.

This runbook covers Postgres schema, roles, and database data. Supabase Storage
objects, Auth provider configuration, email/SMTP settings, API keys, and other
project settings need separate backup/configuration procedures.

## Create an encrypted export

Prerequisites: current Supabase CLI, `age`, the database connection string, and
an `age` public recipient whose private identity is stored separately from the
backup destination.

```sh
export SUPABASE_DB_URL='postgresql://...'
export BACKUP_AGE_RECIPIENT='age1...'
./scripts/backup-supabase.sh
```

The script exports roles, schema, and data separately with `supabase db dump`,
archives and encrypts them, and writes a SHA-256 checksum. `.backups/` is ignored
by Git. Store the encrypted archive in a separate access-controlled location
and retain the private `age` identity separately. Never commit connection
strings, private keys, or plaintext dumps.

The workflow runs daily at 03:00 Asia/Kolkata and can also be started manually.
After configuring the secrets, run it manually once and confirm the artifact
contains both the encrypted archive and checksum. Add a durable off-site copy
policy before relying on backups for business continuity.

## Verify and restore

At least quarterly, verify the checksum and perform a restore into a separate
staging Supabase project. Do not test restoration against production.

```sh
shasum -a 256 -c .backups/supabase/ledgerwise-db-<timestamp>.tar.gz.age.sha256
export BACKUP_AGE_IDENTITY_FILE='/secure/path/to/age-identity.txt'
age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" \
  --output /tmp/ledgerwise-db.tar.gz \
  .backups/supabase/ledgerwise-db-<timestamp>.tar.gz.age
mkdir -p /tmp/ledgerwise-restore
tar -xzf /tmp/ledgerwise-db.tar.gz -C /tmp/ledgerwise-restore
```

Restore the extracted files to a disposable compatible Postgres/Supabase
environment using Supabase's documented restore process. Validate table and
row counts, RLS policies, functions, triggers, Auth sign-in, and Storage
separately before relying on the restored environment. A database restore is
not complete until those non-database settings and objects have also been
re-established.

See [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
and [Supabase CLI database dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
for current platform steps and limitations.
