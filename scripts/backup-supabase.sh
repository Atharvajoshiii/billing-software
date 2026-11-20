#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the database connection string}"
: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to the age public recipient}"

command -v supabase >/dev/null || { echo "Supabase CLI is required." >&2; exit 1; }
command -v age >/dev/null || { echo "age is required for encrypted backups." >&2; exit 1; }

backup_dir="${LEDGERWISE_BACKUP_DIR:-.backups/supabase}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$backup_dir/ledgerwise-db-$stamp.tar.gz.age"

supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$work_dir/roles.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work_dir/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --use-copy --data-only -f "$work_dir/data.sql"

tar -czf "$work_dir/ledgerwise-db-$stamp.tar.gz" -C "$work_dir" roles.sql schema.sql data.sql
age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" \
  --output "$archive" "$work_dir/ledgerwise-db-$stamp.tar.gz"
shasum -a 256 "$archive" > "$archive.sha256"
chmod 600 "$archive" "$archive.sha256"

printf 'Encrypted backup created: %s\n' "$archive"
printf 'Copy it to a separate, access-controlled storage location.\n'
