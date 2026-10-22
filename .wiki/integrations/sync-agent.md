# Agente de Ingestao (`wmsfull-sync`)

> **Ultima revisao:** 2026-10-22
> **Decisao:** [[decisions/007-ingestao-por-agente-push]]
> **Codigo:** `sync-agent/`

Componente que roda **fora** do Coolify, no servidor interno, e empurra os dados do ERP
para a API publica. Nao abre porta, nao recebe conexao, nao precisa de VPN.

```
ERP (rede interna)  ->  wmsfull-sync  --HTTPS-->  API publica
```

---

## 1. O que ele envia

| Dado | Origem | Regra |
|---|---|---|
| `codigo`, `referencia`, `descricao`, `ean13`, `qtd_embalagem` | view `wms_produtos` | upsert por `codigo` |
| NFs + itens | view `wms_nf_itens` (uma linha por item) | upsert por `chave_nfe` |

O agente **nao** envia e nunca altera `localizacao`, `estoque_caixas` nem `ean14` — esses
campos sao do WMSFull.

---

## 2. Cadencia

| Origem | Disparo |
|---|---|
| `agenda` | `SYNC_HORARIOS` (default `06:00,12:00,18:00`), com recuperacao de horario perdido |
| `manual` | admin clica "Sincronizar agora"; o agente consulta o pedido a cada 2 min |

Recuperacao de horario perdido: se o servidor estava desligado as 06:00 e subiu as 09:00, a
execucao acontece assim que o agente inicia.

---

## 3. Contrato das views

O detalhe (colunas, tipos e SQL de exemplo) esta em `sync-agent/README.md`. Resumo:

- `wms_produtos(codigo, referencia, descricao, ean13, qtd_embalagem)`
- `wms_nf_itens(chave_nfe, numero, serie, cnpj_cliente, cliente, endereco,
  data_emissao, codigo_produto, qtd_nota, qtd_embalagem)` — nota de saida

O usuario do banco deve ser **somente leitura** (`GRANT SELECT` nas duas views), e o agente
abre a conexao em modo `readonly` como segunda barreira.

---

## 4. Autenticacao

Header `X-Sync-Key`, comparado em tempo constante com `SYNC_API_KEY` (env da API).
Ausente ou diferente: 401. Chave nao configurada na API: 503 — desabilitado de proposito.

A chave e separada do JWT de usuario e nao aparece no bundle do frontend.

---

## 5. Operacao

```bash
cd sync-agent
cp .env.example .env     # WMS_API_URL, SYNC_API_KEY, ERP_DATABASE_URL
docker compose up -d --build
docker compose logs -f
```

O painel em `/admin` > Sincronizacao mostra a ultima execucao por origem, quantos registros
entraram, quantos erraram e o detalhe de cada erro.

### Sinais de problema

| Sinal no painel | Significado |
|---|---|
| nenhuma execucao nas ultimas horas | agente parado ou sem rede |
| `status=erro` | falha de leitura do ERP ou de conexao com a API (mensagem no card) |
| `parcial` | parte dos itens foi recusada; ver "erros" na execucao |
| muitos `ean13 invalido` | dado errado no ERP: corrigir na origem |
| `NF X esta em 'em_conferencia': sync ignorado` | comportamento esperado, nao e falha |

---

## 6. O que ainda nao existe

- **Alerta ativo** quando o agente para (hoje so o painel mostra; ver P1-12 no backlog).
- Driver de MySQL/SQL Server: so Postgres e implementado. Basta uma nova classe em
  `sync-agent/sources.py`.
- Envio incremental de produtos: hoje envia o catalogo inteiro (1.997 linhas, cerca de 6
  lotes). Barato e sem estado, mas vira problema acima de ~100 mil SKUs.

---

## Links Relacionados

- [[decisions/007-ingestao-por-agente-push]]
- [[integrations/data-sources]]
- [[integrations/api-catalog]]
- [[architecture/data-flow]]
