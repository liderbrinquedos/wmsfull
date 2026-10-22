# ADR-004: PWA instalavel, sem fila offline

> **Data:** 2026-10-22
> **Status:** accepted
> **Autor:** liderbrinquedos

## Contexto

O WMSFull e usado em campo: o operador bipa caixas no docks e o motorista registra a
entrega no endereco do cliente. Os dois ambientes tipicos - doca e rua - tem cobertura de
rede instavel.

O frontend ja e uma PWA instalavel: `vite-plugin-pwa` com Workbox em modo `generateSW`,
`registerType: 'autoUpdate'` e precache do shell estatico (`**/*.{js,css,html,ico,png,svg,woff2}`).
O app abre e navega offline; a interface e sempre carregada.

Porem, os **dados** nao sobrevivem a falta de conexao:

- nao existe `runtimeCaching` para `/api` - nenhuma resposta de API e cacheada;
- nao existe IndexedDB nem `idb` no projeto;
- nao existe `BackgroundSyncPlugin` nem fila de reenvio;
- nao ha tratamento de `navigator.onLine` nem tela de "sem conexao";
- a unica persistencia local e o `localStorage` com `token` e `user`.

Resultado: **o app abre offline, mas nenhuma operacao pode ser feita offline.** Uma
bipagem ou uma entrega realizada sem rede se perde silenciosamente.

O `logstock` (WMS Flow) ja resolveu esse problema com IndexedDB + `idb` e sincronizacao
offline/online; o `logconf` (Conferencia NF-e) tem o padrao de `/api/sync` com fila de
leituras no backend.

## Decisao

**Manter o PWA instalavel com precache do shell (como esta) e NAO implementar fila offline
nesta etapa.** O app e declarado como "instalavel", e nao como "offline-first".

Consequencias praticas, aceitas conscientemente:

- A operacao de campo **exige conexao** no momento da bipagem ou da baixa.
- Em caso de queda de rede, o operador/motorista ve erro e a operacao **nao** e
  registrada - precisa repetir quando a rede voltar.
- O plano de producao deve considerar esse limite explicitamente (ver
  `.wiki/brain/current-focus.md`).

Casos em que a decisao precisa ser revista:

1. Relato de operacao em area sem cobertura suficiente.
2. Volume de NFs/dia que justifique o investimento.
3. Custo de implementacao: IndexedDB + fila + endpoint de sync idempotente + resolucao de
   conflitos.

## Alternativas Consideradas

| Alternativa | Pros | Contras |
|---|---|---|
| Fila offline completa (IndexedDB + sync) | Zero perda de operacao | Investimento alto; conflitos, idempotencia, UX de "pendente"; o `logstock` mostra o custo |
| `runtimeCaching` network-first para `/api` | Leituras funcionam offline | **Escorregadio perigoso**: devolve dado velho sem sinalizacao, e nao resolve escrita |
| `BackgroundSyncPlugin` do Workbox | Reenvio automatico de POST | So funciona para requests em fila; exige cache de rotas POST no SW; ainda nao resolve leitura |
| Manter como esta (decidido) | Zero trabalho extra; PWA instalavel funciona | Perda de operacao em area sem rede |

## Consequencias

- **Positivas:** o app e instalavel e abre instantaneamente, mesmo sem rede; o service
  worker e gerado automaticamente (sem codigo de registro no `src/`); nenhuma
  complexidade de sincronizacao no modelo de dados (que hoje nao tem `usuario_id` em
  `nf_itens`, nem chave de idempotencia).
- **Impacto no codigo:** nenhuma mudanca imediata. O `vite.config.ts` segue com
  `globPatterns` apenas.
- **Impacto na equipe:** a documentacao precisa dizer "instalavel, nao offline" para
  ninguem prometer offline ao usuario final - este ADR e o README registram isso.
- **Negativas:** perda silenciosa de bipagens e entregas em area sem rede.

## Bugs Correlatos (ja registrados)

Enquanto o SW nao tem `runtimeCaching`, dois bugs afetam a atualizacao do proprio PWA:

- A regra de estaticos do nginx casa `sw.js` e aplica `immutable` (cache de 1 ano),
  impedindo o navegador de buscar a versao nova - o `autoUpdate` fica neutralizado
  (backlog P2-06).
- `add_header` dentro de `location` nao herda os do nivel `server`, entao
  `Service-Worker-Allowed` nao chega ao `sw.js` (backlog P2-07).

## Links Relacionados

- [[architecture/data-flow]]
- [[brain/business-rules]]
- [[decisions/001-arquitetura-fastapi-react-pwa]]
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
