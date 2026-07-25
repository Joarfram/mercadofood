# MercadoFood v2.1 — Complementos avançados

Esta etapa permite configurar escolhas detalhadas por produto.

## Exemplos
- Tamanho: pequeno, médio e grande.
- Sabores: até dois sabores.
- Ponto da carne: malpassada, ao ponto ou bem-passada.
- Borda: sem borda, cheddar ou catupiry.
- Acompanhamentos: múltipla escolha.
- Quantidades: até três adicionais do mesmo item.

## Nova rota
`/produtos/[productId]/complementos`

## Banco de dados
Execute a migration `0020_advanced_product_options.sql` depois das anteriores.

## Regras
- O mínimo define se a escolha é obrigatória.
- O máximo limita quantas opções podem ser escolhidas.
- O campo “grátis” prepara o modelo para cobrar somente opções acima da franquia.
- O limite por opção permite itens em quantidade.

A cobrança por quantidade e franquia gratuita será refinada no checkout em uma etapa posterior. Nesta versão, o cardápio já recebe e exibe os metadados avançados.
