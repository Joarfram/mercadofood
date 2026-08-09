# Reparo de segurança MercadoFood v2.8

Este pacote não deve ser aplicado diretamente em produção. Primeiro restaure uma cópia recente do banco em staging e valide as contas de teste de duas empresas diferentes.

## Alterações

- Server Actions sensíveis reafirmam a permissão do módulo no servidor.
- `0037_security_permissions_hardening.sql` remove execução pública implícita de funções privilegiadas e restringe pedidos, itens e pagamentos por função.
- `0038_staff_order_transaction.sql` cria o pedido interno, item, pagamento, cupom e fidelidade em uma única transação.
- Pedidos internos usam uma chave de idempotência para impedir duplicação por toque duplo.
- O shell administrativo e o caixa rápido não impõem largura desktop no celular.

## Aplicação em staging

1. Confirmar backup restaurável e registrar a versão atual das migrations.
2. Aplicar `0037_security_permissions_hardening.sql`.
3. Aplicar `0038_staff_order_transaction.sql`.
4. Executar novamente o Security Advisor do Supabase.
5. Testar owner, manager, attendant, kitchen, cashier, stock, driver e viewer.
6. Confirmar que um usuário da empresa A não lê nem altera dados da empresa B.
7. Testar pedido normal, toque duplo, cupom no limite, fidelidade concorrente e falha forçada na criação do pagamento.
8. Validar cardápio, mesa, rastreamento e feedback públicos, pois são os contratos anônimos explicitamente preservados.

## Critérios de aceite

- Nenhuma função administrativa `SECURITY DEFINER` pode ser executada por `anon`.
- Motoboy não cria nem altera pedidos administrativos.
- Cozinha altera apenas o fluxo operacional permitido.
- Viewer não grava dados.
- Um erro em item ou pagamento desfaz todo o pedido interno.
- A mesma chave de idempotência retorna o mesmo pedido.
- A tela financeira não possui rolagem horizontal em 320, 375, 390 e 430 px.

## Rollback

O rollback recomendado é restaurar o snapshot criado imediatamente antes das migrations. Não reaplique as políticas amplas antigas manualmente, pois elas são a origem do bypass por função.

Se apenas o código precisar ser revertido antes da publicação das migrations, restaure a versão anterior da aplicação. Se as migrations já tiverem sido aplicadas, reverta banco e aplicação juntos para evitar incompatibilidade com a nova função transacional.
