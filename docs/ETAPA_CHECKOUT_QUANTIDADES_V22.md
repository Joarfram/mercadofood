# MercadoFood v2.2 — Checkout com quantidades e gratuidades

## Entregas desta etapa

- Quantidade de cada item diretamente no carrinho.
- Quantidade por complemento, respeitando o limite de cada opção.
- Validação do mínimo e máximo por grupo.
- Grupos de escolha única, múltipla e por quantidade.
- Primeiras unidades grátis por grupo.
- Acréscimo somente nas unidades acima do limite grátis.
- Resumo detalhado dos complementos no carrinho.
- Recalculo integral no Supabase, sem confiar no preço do navegador.
- Registro de quantidade selecionada, gratuita e cobrada.

## Regra das opções grátis

Quando um grupo permite unidades grátis, a gratuidade é aplicada primeiro às opções selecionadas de maior valor. A mesma regra é mostrada no cardápio e executada no banco de dados.

Exemplo:

- Grupo permite 2 unidades grátis.
- Cliente escolhe 1 bacon de R$ 4,00, 1 queijo de R$ 3,00 e 1 molho de R$ 1,00.
- Bacon e queijo ficam grátis.
- O sistema cobra apenas R$ 1,00 pelo molho.

## Instalação

Execute as migrations anteriores e depois:

`supabase/migrations/0021_checkout_quantities_free_options.sql`

## Testes recomendados

1. Produto sem complementos.
2. Grupo obrigatório de escolha única.
3. Grupo com máximo de duas escolhas.
4. Opção com quantidade máxima maior que um.
5. Grupo com duas unidades grátis e três selecionadas.
6. Duas unidades do mesmo produto no carrinho.
7. Tentativa de enviar opção inválida pelo navegador.
8. Tentativa de ultrapassar o limite do grupo ou da opção.
