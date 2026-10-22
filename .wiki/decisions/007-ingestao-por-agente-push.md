# ADR-007: Ingestao de dados por agente push

> **Data:** 2026-10-22
> **Status:** accepted
> **Autor:** liderbrinquedos

## Contexto

O WMSFull precisa de dados que so existem no ERP da empresa, e o ERP esta em um banco
**inalcancavel pela internet**. Ao mesmo tempo, o app precisa ser publico: o motorista
opera em rua, com celular pessoal e 4G, sem VPN e sem rede controlada pela empresa.

Ou seja, as duas pontas estao em lados opostos de um firewall e **nao podem se falar
diretamente**:

```
ERP + banco        (rede interna, fechada)
App + API          (internet, publica)
```

Tres caminhos foram avaliados para cruzar essa fronteira:

| Caminho | Direcao | O que exige |
|---|---|---|
| Agente push | interno -> internet | saida 443 apenas |
| Export + import manual | humano | ninguem exposto, mas depende de pessoa |
| Tunel/VPN | internet -> interno | porta aberta ou tunel para dentro da rede |

## Decisao

**Agente push.** Um container `wmsfull-sync` roda no servidor interno que ja tem acesso ao
banco do ERP e saida para a internet. Ele:

1. conecta no ERP com **usuario read-only**, lendo **views dedicadas** (nunca tabela crua);
2. extrai produtos e notas fiscais em lotes de ate 500;
3. envia por HTTPS para a API publica, autenticado por `X-Sync-Key`;
4. registra o resultado em `sync_runs` e dorme.

O app publico **nunca inicia conexao para a rede interna**. Nao ha tunel, nao ha porta
aberta, nao ha IP fixo, nao ha VPN.

Cadencia: agenda fixa (06h, 12h, 18h) **mais** fallback sob demanda. O botao "Sincronizar
agora" na UI apenas grava um pedido no banco (`sync_requests`); o agente consulta
`GET /sync/requests/pending` a cada 2 minutos e atende. A comunicacao continua sendo de
dentro para fora.

### Regras de fusao que a decisao implica

O sync nunca e dono de tudo. Os campos de propriedade do WMSFull sao intocaveis:

| Campo | Dono | Sync |
|---|---|---|
| `codigo`, `referencia`, `descricao`, `ean13`, `qtd_embalagem` | ERP | sobrescreve quando traz valor |
| `localizacao`, `estoque_caixas` | WMSFull | **nunca** toca |
| `ean14` | ficha/admin | **nunca** toca |
| NF `pendente` | ERP | atualiza cabecalho e itens |
| NF `em_conferencia` ou alem | WMSFull | **ignora** |

Erro e **por item**, nao por lote: uma linha invalida vira registro em `sync_run_errors` e
o restante do lote entra.

## Alternativas Consideradas

| Alternativa | Pros | Contras |
|---|---|---|
| **Agente push (decidido)** | ERP fechado; cadencia exata; auditavel por `sync_runs`; nao abre porta | mais um container para operar e monitorar |
| App consultando API/banco interno via tunel ou VPN | dado em tempo real; sem duplicacao | expoe a rede interna a um host publico; credencial do ERP no host publico; toda tela passa a depender de um link fora do nosso controle |
| Export + import manual de `.xlsx` | zero infraestrutura; padrao do `logconf` | erro humano; sem tempo real; NF so entra quando alguem sobe o arquivo |
| Leitura direta do ERP pelo WMSFull hospedado na nuvem | simples de escrever | inviavel: o ERP nao e alcancavel pela internet |

O import de planilhas **nao foi descartado** — ele permanece como caminho para os dados que
ja nascem em arquivo (fichas de EAN14/DUN14 e planilha de localizacao) e como contingencia
quando o agente estiver fora.

## Consequencias

- **Positivas:** o perimetro da rede interna permanece fechado; o firewall so precisa
  permitir saida 443, que ja e permitida; a queda de internet da empresa **atrasa o sync**
  mas nao derruba o app (o motorista continua entregando com o dado que ja esta no
  Postgres); toda execucao e auditavel (quando, quantos, quantos erros).
- **Impacto no codigo:** novos endpoints `/sync/*` com autenticacao por chave (separada do
  JWT de usuario); tres tabelas de controle; painel `GET /admin/sync/status`; botao
  "Sincronizar agora" no admin.
- **Impacto na equipe:** existe um componente novo fora do Coolify, no servidor interno.
  Alguem precisa saber reinicia-lo e ler o log dele. O monitoramento passa a incluir "a
  ultima execucao foi ha quanto tempo".
- **Negativas e riscos:**
  - **Agente parado e silencioso.** Sem painel, ninguem percebe que o catalogo esta velho.
    Mitigacao: `sync_runs` + indicador de "ultima sincronizacao" no admin.
  - **Latencia de ate 3 horas** entre a emissao da NF no ERP e a disponibilidade na doca.
    Aceito explicitamente; o fallback manual reduz esse tempo quando necessario.
  - **Dois pontos de configuracao** (credencial do ERP no servidor interno, `SYNC_API_KEY`
    nos dois lados) que precisam ser rotacionados juntos.
  - **Dependencia do schema do ERP.** Se o ERP mudar uma coluna, quebra no agente — e nao
    no app. As views dedicadas reduzem esse acoplamento.
  - **Driver do banco do ERP ainda desconhecido** (PostgreSQL, MySQL ou SQL Server). Nao
    bloqueia as fases 1 e 4 do roadmap, mas precisa ser confirmado antes da fase 3.

## Links Relacionados

- [[integrations/data-sources]]
- [[architecture/data-flow]]
- [[decisions/006-alembic-e-migracoes]]
- `docs/superpowers/specs/2026-10-22-producao-e-fontes-de-dados-design.md`
