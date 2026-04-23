#!/usr/bin/env bash
# Snapshot de la base de datos de producción.
# Uso: npm run db:snapshot
#
# Genera un volcado binario (formato custom de pg_dump) en backups/ con
# timestamp. Diseñado como red de seguridad antes de migraciones, no como
# sistema de backup continuo (Supabase ya hace los suyos).
#
# Restaurar luego con:
#   pg_restore -d "$DIRECT_URL" --clean --no-owner --no-acl <archivo.dump>

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v pg_dump >/dev/null 2>&1; then
  cat >&2 <<'EOF'
✗ pg_dump no está instalado.

  Instálalo con:
    brew install libpq
    brew link --force libpq        # añade pg_dump al PATH

  (libpq es el cliente de Postgres, no instala el servidor.)
EOF
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "✗ No encuentro .env en la raíz del proyecto." >&2
  exit 1
fi

# Lee DIRECT_URL del .env sin contaminar el entorno actual
DIRECT_URL=$(grep -E '^DIRECT_URL=' .env | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//')

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "✗ DIRECT_URL no está definido en .env." >&2
  exit 1
fi

mkdir -p backups
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT="backups/bgplanner-${TIMESTAMP}.dump"

echo "→ Volcando BD a ${OUTPUT}…"
pg_dump "$DIRECT_URL" --no-owner --no-acl --format=custom --file="$OUTPUT"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "✓ Snapshot listo (${SIZE}): ${OUTPUT}"
echo
echo "Para restaurar (¡destructivo!):"
echo "  pg_restore -d \"\$DIRECT_URL\" --clean --no-owner --no-acl \"$OUTPUT\""
