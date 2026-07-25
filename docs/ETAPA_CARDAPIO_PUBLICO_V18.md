# MercadoFood v1.8 — Cardápio público e pedido do cliente

## Entregas desta etapa

- Cardápio público por URL: `/cardapio/[slug]`.
- Loja, categorias, produtos, promoções e adicionais carregados do Supabase.
- Busca e filtro por categoria.
- Carrinho com vários produtos.
- Seleção de adicionais obrigatórios e opcionais.
- Observação por item e observação geral.
- Delivery ou retirada.
- Endereço de entrega.
- PIX, dinheiro ou cartão na entrega.
- Aplicação de cupom validada no servidor.
- Criação segura de cliente, pedido, itens, adicionais e pagamento pendente.
- Link de acompanhamento após finalizar o pedido.

## Segurança

Os preços são recalculados dentro do banco. O navegador envia apenas identificadores, quantidades e escolhas. Isso impede que o cliente altere o preço manualmente.

## Configuração

1. Aplicar a migration `0017_public_menu_checkout.sql`.
2. Definir o `slug` da empresa.
3. Manter ao menos uma unidade cadastrada.
4. Cadastrar categorias e produtos ativos.
5. Opcionalmente, cadastrar grupos de adicionais e opções.
6. Abrir `/cardapio/SLUG-DA-LOJA`.

## Próxima etapa

Criar a tela administrativa para configurar a aparência do cardápio, horários, áreas e taxas de entrega, adicionais e publicação do link/QR Code.
