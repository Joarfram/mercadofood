# MercadoFood v0.5 — Produtos e pedidos no Supabase

## Entregue nesta etapa
- Cadastro real de categorias.
- Cadastro real de produtos.
- Pausar e reativar disponibilidade.
- Criação real de cliente quando há telefone.
- Criação real de pedido e itens.
- Criação automática da unidade Matriz quando necessário.
- Atualização do status operacional do pedido.
- Regras RLS para categorias, clientes, unidades e itens.

## Como ativar
1. Configure `.env.local` conforme `.env.example`.
2. Execute as migrations `0001` a `0004` no Supabase, em ordem.
3. Rode `npm install`.
4. Rode `npm run dev`.
5. Cadastre a empresa e faça login.
6. Entre em Produtos, crie categoria e produto.
7. Entre em Pedidos e crie o primeiro pedido.

## Observação
Esta versão depende do Supabase configurado. GPS, mapas, WhatsApp e pagamentos continuam em modo de demonstração ou planejamento.
