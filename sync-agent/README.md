# wmsfull-sync

Agente de ingestao. Roda **no servidor interno**, onde existe acesso ao ERP e saida
para a internet, e empurra os dados para a API publica por HTTPS.

Nao abre porta, nao recebe conexao, nao precisa de IP fixo nem de VPN.

```
ERP (rede interna)  ->  wmsfull-sync  --HTTPS-->  API publica (Coolify)
```

---

## 1. O que ele faz

A cada ciclo:

1. abre uma execucao (`POST /sync/runs`);
2. le os produtos do ERP (`SELECT` em view) e envia em lotes de 500;
3. le as notas dos ultimos `ERP_JANELA_DIAS` dias e envia em lotes de 500;
4. fecha a execucao com as contagens (`POST /sync/runs/{id}/finish`).

Duas origens de execucao:

| Origem | Como dispara |
|---|---|
| `agenda` | horarios fixos (`SYNC_HORARIOS`), com recuperacao de horario perdido |
| `manual` | o admin clica "Sincronizar agora"; o agente consulta `/sync/requests/pending` a cada `SYNC_INTERVALO_SEGUNDOS` |

---

## 2. Contrato das views

O agente **nao le tabela crua**: le duas views. Assim, se o ERP mudar de schema, o ajuste
fica em um `CREATE OR REPLACE VIEW`, e nao no agente.

### `wms_produtos`

| Coluna | Tipo | Obrigatoria |
|---|---|---|
| `codigo` | texto | sim |
| `referencia` | texto | sim (e a chave de juncao com as fichas tecnicas) |
| `descricao` | texto | sim |
| `ean13` | texto (13 digitos) | nao |
| `qtd_embalagem` | inteiro >= 1 | nao |

### `wms_nf_itens` (uma linha por item de nota de saida)

| Coluna | Tipo | Obrigatoria |
|---|---|---|
| `chave_nfe` | texto (44 digitos) | recomendada (e a chave natural) |
| `numero` | texto | sim |
| `serie` | texto | recomendada |
| `cnpj_cliente` | texto (14 digitos) | recomendada |
| `cliente` | texto | sim |
| `endereco` | texto (endereco de entrega) | nao |
| `data_emissao` | data | sim (usada na janela) |
| `codigo_produto` | texto (igual a `wms_produtos.codigo`) | sim |
| `qtd_nota` | inteiro | sim |
| `qtd_embalagem` | inteiro | nao |

> A nota e de **saida**: a empresa emite e o cliente recebe. Nao existe coluna de
> fornecedor — o emitente e sempre a propria empresa.

Exemplo de criacao (ajustar nomes de tabela/coluna ao ERP real):

```sql
CREATE OR REPLACE VIEW wms_produtos AS
SELECT codigo::text        AS codigo,
       referencia::text    AS referencia,
       descricao::text     AS descricao,
       ean13::text         AS ean13,
       qtd_embalagem::int  AS qtd_embalagem
  FROM produtos
 WHERE ativo = 'S';

CREATE OR REPLACE VIEW wms_nf_itens AS
SELECT n.chave_nfe::text   AS chave_nfe,
       n.numero::text      AS numero,
       n.serie::text       AS serie,
       c.cnpj::text        AS cnpj_cliente,
       c.razao_social      AS cliente,
       n.endereco_entrega  AS endereco,
       n.data_emissao      AS data_emissao,
       i.codigo_produto::text AS codigo_produto,
       i.quantidade::int   AS qtd_nota,
       i.qtd_embalagem::int AS qtd_embalagem
  FROM notas n
  JOIN itens i     ON i.nota_id = n.id
  JOIN clientes c  ON c.id = n.cliente_id;
```

### Usuario somente leitura

```sql
CREATE ROLE wms_leitura LOGIN PASSWORD 'troque-esta-senha';
GRANT CONNECT ON DATABASE erp TO wms_leitura;
GRANT USAGE ON SCHEMA public TO wms_leitura;
GRANT SELECT ON wms_produtos, wms_nf_itens TO wms_leitura;
```

O agente ainda abre a conexao em modo `readonly`, como segunda barreira.

---

## 3. Configuracao

| Variavel | Obrigatoria | Default | Para que serve |
|---|---|---|---|
| `WMS_API_URL` | sim | - | ex.: `https://wms.suaempresa.com.br` |
| `SYNC_API_KEY` | sim | - | mesma chave cadastrada na API (`X-Sync-Key`) |
| `ERP_TIPO` | nao | `postgres` | `postgres` ou `csv` |
| `ERP_DATABASE_URL` | se postgres | - | `postgresql://wms_leitura:senha@host:5432/erp` |
| `ERP_VIEW_PRODUTOS` | nao | `wms_produtos` | nome da view |
| `ERP_VIEW_NF` | nao | `wms_nf_itens` | nome da view |
| `ERP_CSV_PRODUTOS` / `ERP_CSV_NF` | se csv | - | caminho dos arquivos |
| `SYNC_HORARIOS` | nao | `06:00,12:00,18:00` | horarios fixos |
| `SYNC_INTERVALO_SEGUNDOS` | nao | `120` | intervalo do polling de pedidos |
| `ERP_JANELA_DIAS` | nao | `3` | janela de notas por `data_emissao` |
| `SYNC_LOTE` | nao | `500` | tamanho do lote |
| `SYNC_AO_INICIAR` | nao | `true` | roda uma vez ao subir |
| `LOG_LEVEL` | nao | `INFO` | `DEBUG`, `INFO`, `WARNING` |

Copie `.env.example` para `.env` e preencha.

---

## 4. Como rodar

```bash
cp .env.example .env
# edite WMS_API_URL, SYNC_API_KEY, ERP_DATABASE_URL

docker compose up -d --build
docker compose logs -f
```

Ou sem Docker:

```bash
pip install -r requirements.txt
set -a && . ./.env && set +a
python -u agent.py
```

### Teste sem ERP (modo CSV)

Serve para validar a ponta da API antes de ter acesso ao ERP:

```bash
ERP_TIPO=csv \
ERP_CSV_PRODUTOS=./exemplos/produtos.csv \
ERP_CSV_NF=./exemplos/nf_itens.csv \
WMS_API_URL=http://localhost:8005 \
SYNC_API_KEY=chave-de-teste \
SYNC_AO_INICIAR=true \
python -u agent.py
```

---

## 5. O que o agente NAO faz

- Nao escreve no ERP (`SELECT` e conexao readonly).
- Nao toca em `localizacao`, `estoque_caixas` nem `ean14` — esses campos sao do WMSFull.
- Nao regride nota que ja saiu de `pendente` (a API recusa e registra o motivo).
- Nao apaga nada: so faz upsert por `codigo` (produto) e por `chave_nfe` (nota).

---

## 6. Problemas comuns

| Sintoma | Causa provavel |
|---|---|
| `503 Sincronizacao desabilitada` | `SYNC_API_KEY` vazia na API (env do Coolify) |
| `401 X-Sync-Key invalida` | chave diferente nos dois lados |
| execucao com `status=erro` e mensagem de conexao | `ERP_DATABASE_URL` errado ou firewall |
| muitos erros `ean13 invalido` | dado errado no ERP: corrigir na origem |
| erros `item X: produto nao cadastrado` | a nota referencia produto que a view de produtos nao trouxe (talvez inativo) |
