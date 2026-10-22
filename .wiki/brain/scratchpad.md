# Scratchpad - WMSFull

> Area livre para rascunho. Nada aqui e definitivo - mova o que importa para `brain/`,
> `decisions/` ou `patterns/` e limpe aqui.

---

## Pendencias do brainstorm de producao

_(ver `[[current-focus]]` para a lista viva)_

---

## Perguntas em aberto

- O ERP de origem e o mesmo da familia `logconf`? O formato do `.xlsx` de produtos e
  reaproveitavel?
- A localizacao do estoque (endereco fisico) vive no ERP ou e exclusiva do WMSFull?
- Quem e a fonte de verdade do estoque: o ERP manda a quantidade e o WMSFull so
  endereca, ou o WMSFull tambem controla a quantidade?
- Como tratar divergencia entre o estoque do ERP e o do WMSFull?
- O volume de NFs por dia justifica fila offline real ou basta retry com backoff?

---

## Ideias soltas

- Bipar pela camera do celular (hoje so existe leitor USB + input de texto).
- Exportacao de relatorios em `.xlsx` (o `logconf` e o `logstock` ja fazem isso).
- Codebar do proprio cliente (EAN-13 do item) em vez do master.
- Debito de estoque na entrega.
- Multi-armazem / multi-filial.
