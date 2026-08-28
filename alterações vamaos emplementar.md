# Alterações — vamos implementar

## Decisão de produto

**Complementos e Adicionais** deve permanecer no menu principal do MercadoFood.

Essa é uma área operacional do cardápio, acessada com frequência pelo restaurante, e não apenas uma configuração geral. A organização adotada é:

- **Produtos:** o que a loja vende.
- **Categorias:** como os produtos são organizados.
- **Combos:** conjuntos de produtos vendidos como oferta.
- **Complementos e Adicionais:** opções escolhidas junto com os produtos, como queijo extra, bacon, molhos, tamanho, borda, acompanhamento e ponto da carne.

O nome exibido será **Complementos e Adicionais**, pois “adicionais” é mais imediato para usuários que ainda não conhecem sistemas de restaurante.

## Experiência esperada

A área deve permitir:

- cadastrar grupos e opções;
- editar nomes, regras e preços;
- ativar ou desativar grupos e opções;
- usar foto quando necessário;
- visualizar em quais produtos cada grupo é usado;
- reutilizar o mesmo grupo em vários produtos;
- refletir uma alteração de preço em todos os produtos vinculados ao mesmo complemento.

Exemplo: o grupo **Adicionais do Hambúrguer** contém Bacon + R$ 3, Queijo + R$ 2 e Ovo + R$ 2 e pode ser ligado a vários hambúrgueres.

## Implementação desta etapa

- adicionar **Complementos e Adicionais** ao menu principal;
- criar uma central operacional em `/complementos`;
- listar os grupos existentes, seus produtos, opções, status e regras;
- oferecer acesso direto à edição completa de cada grupo no produto atual;
- manter o controle de acesso no módulo de Produtos.

## Reutilização global implementada

Foi criada a migração `20260827190000_reusable_product_option_groups.sql`, que adiciona o relacionamento muitos-para-muitos em `product_option_group_links`, preserva os vínculos atuais e atualiza o cardápio público e o checkout.

A central agora permite vincular e desvincular o mesmo grupo em vários produtos. Como as opções pertencem ao grupo compartilhado, alterações de nome ou preço passam a refletir em todos os produtos vinculados.


