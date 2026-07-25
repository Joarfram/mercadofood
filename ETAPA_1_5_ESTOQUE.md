# MercadoFood v1.5 — Estoque e ficha técnica

## Entregas
- Cadastro de insumos com unidade, custo, estoque atual e estoque mínimo.
- Entradas, perdas, ajustes e retornos manuais.
- Ficha técnica ligando produtos a ingredientes e quantidades.
- Baixa automática quando o pedido muda para `accepted`.
- Estorno automático quando um pedido com baixa aplicada é cancelado.
- Alertas de estoque mínimo.
- Histórico das últimas movimentações.
- Estimativa financeira do estoque.

## Instalação
1. Execute as migrations anteriores na ordem.
2. Execute `supabase/migrations/0014_inventory_recipes.sql`.
3. Configure `.env.local` com as chaves do Supabase.
4. Execute `npm install` e `npm run dev`.
5. Acesse `/estoque`.

## Teste recomendado
1. Cadastre farinha em gramas e carne em gramas.
2. Cadastre um produto em `/produtos`.
3. Monte a ficha técnica do produto.
4. Crie um pedido com esse produto.
5. Na cozinha, aceite o pedido.
6. Confira a baixa automática em `/estoque`.
7. Cancele o pedido e confira o retorno ao estoque.

## Observação
A primeira versão não converte unidades automaticamente. A unidade da ficha técnica deve ser a mesma unidade do insumo.
