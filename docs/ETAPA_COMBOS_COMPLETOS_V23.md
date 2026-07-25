# MercadoFood v2.3 — Combos completos

Esta etapa adiciona o cadastro de refeições montadas por etapas.

## O que foi incluído

- Cadastro de combo com preço normal e promocional.
- Etapas como “Escolha o lanche”, “Escolha a bebida” e “Escolha o acompanhamento”.
- Quantidade mínima e máxima por etapa.
- Quantidade de escolhas incluídas gratuitamente.
- Acréscimo para troca por produto mais caro.
- Limite de quantidade por opção.
- Pausa e ativação do combo.
- Estrutura de banco para registrar as escolhas no pedido.
- Função pública `get_public_combos` para carregar os combos no cardápio.

## Migration

Execute `supabase/migrations/0022_complete_combos.sql` no projeto Supabase.

## Nova rota

- `/combos`

## Exemplo

Combo X-Burger:

1. Escolha 1 lanche.
2. Escolha 1 acompanhamento.
3. Escolha 1 bebida.
4. Refrigerante lata incluído; refrigerante 600 ml pode ter acréscimo.

## Próxima etapa

Integrar visualmente os combos ao cardápio público e ao carrinho, validando e recalculando todas as escolhas no servidor durante o checkout.
