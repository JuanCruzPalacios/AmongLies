#!/bin/sh
# Busca credenciales en el código antes de que lleguen al repo.
#   --staged : revisa sólo los cambios en stage (lo usa el hook pre-commit)
#   (sin args): revisa todos los archivos versionados (lo usa el CI)
# Las claves publishable/anon de Supabase son públicas y no se marcan.

PATTERNS='sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{36}|(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_JWT_SECRET)=[^[:space:]]+|postgres(ql)?://[^:/[:space:]]+:[^@[:space:]]+@'

cd "$(git rev-parse --show-toplevel)" || exit 1
failed=0

if [ "$1" = "--staged" ]; then
  matches=$(git diff --cached -U0 --diff-filter=d | grep -E '^\+' | grep -v '^+++' | grep -nE "$PATTERNS")
  envs=$(git diff --cached --name-only --diff-filter=d | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$')
else
  matches=$(git grep -nIE "$PATTERNS" -- . ':!*check-secrets.sh')
  envs=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$')
fi

if [ -n "$matches" ]; then
  echo "FALLO: posible credencial en el código:"
  echo "$matches"
  failed=1
fi
if [ -n "$envs" ]; then
  echo "FALLO: archivo .env versionado (sólo se commitea .env.example):"
  echo "$envs"
  failed=1
fi

[ "$failed" -eq 0 ] && echo "OK - no se encontraron secretos."
exit "$failed"
