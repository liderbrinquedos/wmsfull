# Playbook de Deploy — WMSFull no Coolify

> **Ultima revisao:** 2026-10-22
> **Fase:** 2 do roadmap (`docs/superpowers/specs/2026-10-22-producao-e-fontes-de-dados-design.md`)

Deploy de uma app Docker Compose (banco + migrations + API + nginx) com dominio proprio e
TLS, no mesmo padrao de `logdriver` e `secontrola`.

---

## 1. Pre-requisitos do servidor

- Coolify instalado e acessivel.
- Docker com espaco em disco para as imagens (o build do frontend usa Node).
- **Swap** se a maquina tiver menos de 2 GB de RAM (`npm run build` + build da imagem
  Python estouram memoria sem swap):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

- DNS: registro `A` de `wms.SEUDOMINIO.com.br` apontando para o servidor **antes** do
  deploy. O Let's Encrypt so emite o certificado se o dominio ja resolver.
- Firewall: 80 e 443 abertos. Nenhuma porta da aplicacao precisa ser publicada.

---

## 2. Criar o recurso no Coolify

| Campo | Valor |
|---|---|
| Tipo | Docker Compose (from Git) |
| Repositorio | `git@github.com:liderbrinquedos/wmsfull.git` |
| Branch | `main` |
| Base Directory | `/` |
| Docker Compose Location | `/docker-compose.yml` |

O **`docker-compose.override.yml` nao e usado** pelo Coolify: ele so existe para o
ambiente local (portas publicadas). Se as portas aparecerem publicadas em producao,
o arquivo errado foi apontado.

Servicos que sobem nesta ordem: `logfull-db` -> `logfull-migrate` (one-shot) ->
`logfull-api` -> `logfull-web`.

---

## 3. Variaveis de ambiente

Cadastrar em **Environment Variables** do recurso.

| Variavel | Obrigatoria | Exemplo / como gerar |
|---|---|---|
| `POSTGRES_PASSWORD` | sim | senha forte, sem `@ : / ? #` (vai dentro da URL) |
| `DATABASE_URL` | sim | `postgresql://logfull:SENHA@logfull-db:5432/logfull` |
| `SECRET_KEY` | sim | `openssl rand -hex 32` |
| `SYNC_API_KEY` | sim | `openssl rand -hex 32` (mesma chave do agente) |
| `SEED_DEMO_DATA` | sim | `false` |
| `ADMIN_EMAIL` | recomendada | e-mail do primeiro admin |
| `ADMIN_SENHA` | recomendada | senha forte (min. 8); remover depois do primeiro acesso |
| `CORS_ORIGINS` | nao | vazio (mesma origem) |
| `TZ` | nao | `America/Sao_Paulo` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | nao | `480` |

`SECRET_KEY`, `DATABASE_URL` e `POSTGRES_PASSWORD` nao tem valor padrao no codigo: sem
elas o deploy **falha no boot**, de proposito. `POSTGRES_PASSWORD` e `DATABASE_URL`
precisam ter a mesma senha.

> Trocar `SECRET_KEY` invalida todos os tokens: todo mundo precisa logar de novo.

---

## 4. Dominio e TLS

1. No servico **`logfull-web`**, configurar o dominio `wms.SEUDOMINIO.com.br` na porta
   **80**.
2. Ativar TLS (Let's Encrypt) e "Redirect to HTTPS".
3. Nao criar dominio para `logfull-api` nem para `logfull-db`. A API e alcancada pelo
   nginx em `/api/`.

---

## 5. Primeiro deploy — o que olhar no log

Do topo para baixo:

1. build de `logfull-api` (pip) e `logfull-web` (npm + vite);
2. `logfull-db` fica `healthy`;
3. `logfull-migrate` roda `alembic upgrade head` e termina com **Exited (0)**;
4. `logfull-api` fica `healthy` (`GET /health` internamente);
5. `logfull-web` sobe.

| Sintoma no log | Causa |
|---|---|
| `port is already allocated` | compose com `ports:` publicado no lugar de `expose:` |
| `required variable ... is missing a value` | env nao cadastrada no Coolify |
| `type ... already exists` no migrate | migracao antiga sem drop de ENUM (ver ADR-006) |
| migrate `Exited (1)` e api nao sobe | erro de conexao do `DATABASE_URL` ou senha divergente |
| api `unhealthy` e log com `ValidationError` | falta `SECRET_KEY` ou ela tem menos de 32 caracteres |

---

## 6. Verificacao pos-deploy

```bash
# API respondendo por tras do nginx (o /api e removido no proxy)
curl -s https://wms.SEUDOMINIO.com.br/api/health
# {"status":"healthy"}

# /sync sem chave precisa dar 401 (prova que a chave esta ativa)
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://wms.SEUDOMINIO.com.br/api/sync/produtos \
  -H 'Content-Type: application/json' -d '{"produtos":[]}'
# 401
```

Checklist na interface:

- [ ] Login com o admin inicial (`ADMIN_EMAIL` / `ADMIN_SENHA`) e troca de senha
- [ ] `/wms` lista produtos (vazio no primeiro deploy e esperado)
- [ ] `/admin` > Sincronizacao abre sem erro
- [ ] Foto do canhoto sobe pelo celular (testa `client_max_body_size` e a validacao)
- [ ] PWA instala no celular **com 4G**, sem VPN

> O primeiro usuario vem de `ADMIN_EMAIL`/`ADMIN_SENHA` (cadastradas no Coolify): o seed
> cria sozinho quando a tabela de usuarios esta vazia, e nunca sobrescreve quem ja existe.
> Depois do primeiro acesso, remova as duas variaveis (a senha fica no banco, com bcrypt).

---

## 6.1. Sem usuario nenhum

Se o login disser "Email ou senha incorretos" e ninguem souber a senha:

1. cadastre `ADMIN_EMAIL` e `ADMIN_SENHA` no Coolify;
2. rode um redeploy (o `logfull-migrate` executa o seed);
3. o log mostra `Usuario admin inicial criado: ...` — se mostrar
   `Ja existem usuarios`, a tabela nao esta vazia e o problema e outro (senha errada ou
   usuario inativo).

---

## 7. Backup

```bash
# no host, uma vez por dia
30 2 * * * cd /opt/wmsfull && ./scripts/backup.sh /var/backups/wmsfull >> /var/log/wmsfull-backup.log 2>&1
```

O script gera `db-YYYYmmdd-HHMMSS.dump` (formato custom do `pg_dump`) e
`uploads-YYYYmmdd-HHMMSS.tar.gz`, e apaga o que passar de `BACKUP_RETENCAO_DIAS` (30).

### Copia fora do servidor

Backup no mesmo disco nao protege contra perda do servidor. Copiar para fora:

```bash
rclone copy /var/backups/wmsfull remoto:wmsfull-backups --max-age 2d
```

### Restaurar (testar antes de precisar)

```bash
docker compose exec -T logfull-db createdb -U logfull logfull_restore
docker compose exec -T logfull-db pg_restore -U logfull -d logfull_restore < db-XXXX.dump
docker compose exec -T logfull-db psql -U logfull -d logfull_restore -c 'select count(*) from products;'
docker compose exec -T logfull-db dropdb -U logfull logfull_restore
```

Um backup que nunca foi restaurado nao e um backup. O dump de 2026-10-22 foi restaurado
em um banco descartavel e conferido (produtos, notas e versao do Alembic).

---

## 8. Ligar o agente interno

No servidor interno, em `sync-agent/`:

```env
WMS_API_URL=https://wms.SEUDOMINIO.com.br
SYNC_API_KEY=<mesma chave cadastrada no Coolify>
ERP_DATABASE_URL=postgresql://wms_leitura:SENHA@HOST:5432/erp
```

```bash
docker compose up -d --build
docker compose logs -f
```

Conferir em `/admin` > Sincronizacao: a ultima execucao do ERP deve aparecer com
`status ok` e a contagem de registros.

---

## 9. Checklist de go-live (fase 5)

- [ ] `SEED_DEMO_DATA=false` confirmado
- [ ] Usuarios reais criados (admin, supervisores, operadores, motoristas)
- [ ] Agente rodando e a ultima execucao com `status ok`
- [ ] Fichas tecnicas importadas (491 SKUs com DUN14 hoje)
- [ ] Planilha de localizacao importada
- [ ] Backup diario ativo + copia fora do servidor
- [ ] Uma conferencia completa feita de ponta a ponta com uma NF real
- [ ] Uma entrega completa feita pelo celular, com foto, em 4G
- [ ] Alguem sabe reiniciar o agente e ler o log dele

---

## 10. Atualizacoes seguintes

- Push na `main` -> redeploy no Coolify.
- Mudou `requirements.txt` ou `package.json`? Rebuild (nao basta restart).
- Nova migracao entra sozinha: o `logfull-migrate` roda no boot.
- Mudou env de build do frontend? Rebuild obrigatorio (as `VITE_*` entram no bundle).
