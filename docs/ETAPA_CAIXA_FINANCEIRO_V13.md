# MercadoFood v1.3 — Caixa e fechamento diário

Esta etapa adiciona controle operacional de caixa ao painel administrativo.

## Recursos

- abertura de caixa com saldo inicial;
- apenas um caixa aberto por empresa;
- registro de despesa, sangria, reforço, entrada e estorno;
- leitura das vendas pagas no dia;
- separação das vendas em dinheiro;
- cálculo do saldo esperado;
- contagem e fechamento do caixa;
- registro automático de diferença;
- histórico estruturado no Supabase;
- isolamento dos dados por empresa com RLS.

## Nova rota

`/financeiro`

## Instalação

Execute a migration:

`supabase/migrations/0012_cash_flow_closing.sql`

Depois rode:

```bash
npm install
npm run typecheck
npm run dev
```

## Limite desta versão

As vendas pagas são consultadas diretamente nos pedidos. A conciliação automática com banco, adquirente ou gateway ainda não está incluída.
