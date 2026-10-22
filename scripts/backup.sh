#!/usr/bin/env bash
#
# Backup do WMSFull: dump do PostgreSQL + arquivos de upload.
#
#   ./scripts/backup.sh [destino]
#
# Variaveis opcionais:
#   BACKUP_RETENCAO_DIAS  dias de retencao local (default 30)
#   POSTGRES_USER / POSTGRES_DB  (default logfull/logfull)
#
# Rodar no host onde o compose esta de pe (o script usa `docker compose exec`).
# Agende no cron, por exemplo 02:30 diario:
#   30 2 * * * cd /opt/wmsfull && ./scripts/backup.sh /var/backups/wmsfull >> /var/log/wmsfull-backup.log 2>&1
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

DESTINO="${1:-$RAIZ/backups}"
RETENCAO="${BACKUP_RETENCAO_DIAS:-30}"
USUARIO="${POSTGRES_USER:-logfull}"
BANCO="${POSTGRES_DB:-logfull}"
DATA="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DESTINO"

echo "[$(date -Is)] dump do banco $BANCO"
docker compose exec -T logfull-db \
  pg_dump -U "$USUARIO" -d "$BANCO" --format=custom \
  > "$DESTINO/db-$DATA.dump"

echo "[$(date -Is)] arquivos de upload"
docker compose exec -T logfull-api \
  tar -czf - -C /app/uploads . \
  > "$DESTINO/uploads-$DATA.tar.gz"

# Um dump vazio (0 byte) significa que o pg_dump falhou silenciosamente.
if [ ! -s "$DESTINO/db-$DATA.dump" ]; then
  echo "ERRO: dump do banco vazio" >&2
  exit 1
fi

echo "[$(date -Is)] limpando backups com mais de $RETENCAO dias"
find "$DESTINO" -name 'db-*.dump' -mtime "+$RETENCAO" -delete
find "$DESTINO" -name 'uploads-*.tar.gz' -mtime "+$RETENCAO" -delete

echo "[$(date -Is)] ok: $DESTINO/db-$DATA.dump ($(du -h "$DESTINO/db-$DATA.dump" | cut -f1))"
