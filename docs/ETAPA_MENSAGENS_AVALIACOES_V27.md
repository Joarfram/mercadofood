# MercadoFood — Mensagens e avaliações

## Entrega

- Formulário público no cardápio com avaliação de 1 a 5 estrelas.
- Tipos: feedback, sugestão, reclamação e elogio.
- Nome e contato opcionais, mensagem obrigatória e validação de tamanho.
- Central `/mensagens` separada por empresa, com filtros, média das avaliações e contador de não lidas.
- Ações para marcar como lida, registrar resposta, arquivar e excluir com confirmação.
- Atalho de WhatsApp quando o cliente informa um telefone.
- Contador de novas mensagens no menu lateral.
- Item ativo do menu permanece laranja no computador e no celular.
- Permissões: proprietário e gerente podem administrar e excluir; atendente pode ler, responder e arquivar.

## Configuração do Supabase

Execute a migration `supabase/migrations/0032_customer_messages_reviews.sql` depois das migrations anteriores. Ela cria a tabela, os índices, as políticas de segurança e a função pública protegida usada pelo cardápio.

## Teste como cliente

1. Abra `/cardapio/SLUG-DA-LOJA` em uma janela anônima.
2. Clique em **Avaliar a loja**.
3. Selecione as estrelas e o tipo da mensagem.
4. Escreva pelo menos cinco caracteres e envie.
5. Confirme a mensagem de sucesso.

## Teste como proprietário

1. Entre no painel e abra **Mensagens**.
2. Confirme o contador de não lidas e a nova mensagem destacada em laranja.
3. Teste os filtros, marque como lida e registre uma resposta.
4. Arquive a mensagem.
5. Teste a exclusão e confirme que ela desaparece.
6. Navegue por outras abas e confirme que a aba atual permanece laranja até sair dela.

## Observação

A resposta registrada não é enviada automaticamente. Quando houver contato, o painel oferece o atalho do WhatsApp. O envio automático poderá ser conectado ao módulo de WhatsApp futuramente.
