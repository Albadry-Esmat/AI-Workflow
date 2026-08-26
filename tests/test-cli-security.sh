#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$(mktemp -d)"
SOURCE_ENV="$ROOT/.env"
BACKUP=""
cleanup() {
  rm -rf "$TARGET"
  if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then mv "$BACKUP" "$SOURCE_ENV"; else rm -f "$SOURCE_ENV"; fi
}
trap cleanup EXIT

if [[ -f "$SOURCE_ENV" ]]; then
  BACKUP="$(mktemp)"
  cp "$SOURCE_ENV" "$BACKUP"
fi
printf 'GITHUB_TOKEN=do-not-copy-this-test-token\n' > "$SOURCE_ENV"

bash "$ROOT/aiw" init "$TARGET" > "$TARGET/init.log"

test -f "$TARGET/.env"
if grep -q 'do-not-copy-this-test-token' "$TARGET/.env"; then
  echo 'FAIL: aiw init copied a populated source token' >&2
  exit 1
fi
cmp -s "$ROOT/.env.example" "$TARGET/.env"
test "$(stat -c '%a' "$TARGET/.env")" = "600"
grep -q 'intentionally not copied' "$TARGET/init.log"
echo 'PASS: aiw init does not copy populated .env secrets'
